/**
 * Test the sandbox-based NBA stats pipeline locally
 *
 * This script runs the exact same steps as the cron job, but manually
 * so you can watch each step succeed or fail in real time. It does NOT
 * write to KV — it just verifies the sandbox, Python, and stats fetching
 * all work correctly.
 *
 * Usage: deno run -A scripts/test-sandbox.ts
 *
 * Optional flags:
 *   --write-kv           Actually merge and save to KV (like the real cron would)
 *   --create-snapshot     Install deps and save a snapshot for faster future runs
 *   --dry-run             Default — fetch stats but don't save anything
 */

import "@std/dotenv/load";
import { Client, Sandbox, Snapshot } from "@deno/sandbox";
import { mergeNbaStats } from "../lib/merge-stats-core.ts";
import type { NbaStats } from "../lib/merge-stats-core.ts";
import { getPlayers, setPlayers } from "../lib/players-data.ts";

const writeToKv = Deno.args.includes("--write-kv");
const createSnapshot = Deno.args.includes("--create-snapshot");

const SNAPSHOT_SLUG = "nba-stats-python";

async function runInSandbox(
  sandbox: Sandbox,
  cmd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = await sandbox.spawn(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await child.output();
  return {
    code: output.status.code,
    stdout: output.stdoutText ?? "",
    stderr: output.stderrText ?? "",
  };
}

/**
 * Install Python dependencies (pip + nba_api) via apt-get
 *
 * The default sandbox image has Python 3 but no pip.
 * We install python3-pip via apt, then use pip to install nba_api.
 */
async function installDeps(sandbox: Sandbox): Promise<void> {
  // Install pip via apt-get
  console.log("  Installing python3-pip via apt-get...");
  const aptUpdate = await runInSandbox(sandbox, "sudo", [
    "apt-get",
    "update",
    "-qq",
  ]);
  if (aptUpdate.code !== 0) {
    throw new Error(`apt-get update failed: ${aptUpdate.stderr}`);
  }

  const aptInstall = await runInSandbox(sandbox, "sudo", [
    "apt-get",
    "install",
    "-y",
    "-qq",
    "python3-pip",
  ]);
  if (aptInstall.code !== 0) {
    throw new Error(`apt-get install failed: ${aptInstall.stderr}`);
  }
  console.log("  python3-pip installed");

  // Install nba_api via pip
  console.log("  Installing nba_api via pip...");
  const pipResult = await runInSandbox(sandbox, "sudo", [
    "python3",
    "-m",
    "pip",
    "install",
    "--break-system-packages",
    "nba_api",
  ]);
  if (pipResult.code !== 0) {
    throw new Error(
      `pip install failed: ${pipResult.stderr}\n${pipResult.stdout}`,
    );
  }
  console.log("  nba_api installed");
}

async function main() {
  const startTime = Date.now();

  // --create-snapshot mode: install deps and save a reusable snapshot
  if (createSnapshot) {
    console.log("=== Creating snapshot with Python + nba_api ===\n");

    // Create a volume to install into (volumes persist writes)
    console.log("Step 1: Creating sandbox with volume...");
    const client = new Client({});
    const volumeSlug = `${SNAPSHOT_SLUG}-vol`;
    const volume = await client.volumes.create({
      slug: volumeSlug,
      region: "ord",
      capacity: "3GiB",
      from: "builtin:debian-13",
    });
    console.log(`  Volume created: ${volume.slug}\n`);

    await using sandbox = await Sandbox.create({ root: volume.slug });

    // Verify Python is available
    console.log("Step 2: Checking Python...");
    const pyCheck = await runInSandbox(sandbox, "python3", ["--version"]);
    console.log(`  ${pyCheck.stdout.trim()}\n`);

    // Install all dependencies
    console.log("Step 3: Installing dependencies...");
    await installDeps(sandbox);

    // Verify nba_api works
    console.log("\n  Verifying nba_api import...");
    const verify = await runInSandbox(sandbox, "python3", [
      "-c",
      "from nba_api.stats.endpoints import leaguedashplayerstats; print('nba_api OK')",
    ]);
    if (verify.code !== 0) {
      throw new Error(`nba_api verification failed: ${verify.stderr}`);
    }
    console.log(`  ${verify.stdout.trim()}\n`);

    // Close the sandbox so the volume is unmounted
    await sandbox.close();

    // Snapshot the volume
    console.log("Step 4: Creating snapshot...");
    const snapshot = await Snapshot.create(volume.slug, {
      slug: SNAPSHOT_SLUG,
    });
    console.log(`  Snapshot created: ${snapshot.slug} (${snapshot.id})`);

    // The volume can't be deleted while it has snapshots, so just leave it
    console.log(`  Volume "${volumeSlug}" kept (required by snapshot)`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== Snapshot "${SNAPSHOT_SLUG}" ready! (${elapsed}s) ===`);
    console.log(
      `\nUse it with: Sandbox.create({ root: "${SNAPSHOT_SLUG}" })`,
    );
    return;
  }

  // Normal test mode
  console.log("=== Testing sandbox NBA stats pipeline ===\n");

  // Step 1: Try to create sandbox from snapshot, fall back to fresh
  console.log("Step 1/6: Creating sandbox...");
  const existingSnapshot = await Snapshot.get(SNAPSHOT_SLUG);
  let needsInstall = true;

  let sandbox: Sandbox;
  if (existingSnapshot) {
    console.log(`  Using snapshot "${SNAPSHOT_SLUG}" (skipping install)`);
    sandbox = await Sandbox.create({ root: SNAPSHOT_SLUG });
    needsInstall = false;
  } else {
    console.log("  No snapshot found, creating fresh sandbox");
    sandbox = await Sandbox.create();
  }
  console.log("  Sandbox created!\n");

  // Use "await using" equivalent — register cleanup
  const cleanup = () => sandbox.close();

  try {
    // Step 2: Check for Python
    console.log("Step 2/6: Checking for Python...");
    const pyCheck = await runInSandbox(sandbox, "python3", ["--version"]);
    if (pyCheck.code === 0) {
      console.log(`  Found: ${pyCheck.stdout.trim()}`);
    } else {
      throw new Error("Python 3 not found in sandbox");
    }
    console.log("");

    // Step 3: Install deps if needed (skipped when using snapshot)
    if (needsInstall) {
      console.log("Step 3/6: Installing dependencies...");
      await installDeps(sandbox);
      console.log("");
    } else {
      console.log("Step 3/6: Dependencies already in snapshot\n");
    }

    // Step 4: Upload script
    console.log("Step 4/6: Uploading fetch_nba_stats.py to sandbox...");
    const scriptContent = await Deno.readTextFile(
      new URL("./fetch_nba_stats.py", import.meta.url),
    );
    console.log(`  Script is ${scriptContent.length} chars`);
    await sandbox.fs.writeTextFile("/tmp/fetch_nba_stats.py", scriptContent);
    console.log("  Uploaded to /tmp/fetch_nba_stats.py\n");

    // Step 5: Run Python script
    console.log("Step 5/6: Running Python script (this takes ~30s)...");
    const pyResult = await runInSandbox(sandbox, "python3", [
      "/tmp/fetch_nba_stats.py",
    ]);
    console.log(`  Exit code: ${pyResult.code}`);
    if (pyResult.stdout) {
      console.log(
        `  stdout:\n${
          pyResult.stdout.split("\n").map((l: string) => `    ${l}`).join("\n")
        }`,
      );
    }
    if (pyResult.stderr) {
      console.log(
        `  stderr:\n${
          pyResult.stderr.split("\n").map((l: string) => `    ${l}`).join("\n")
        }`,
      );
    }

    if (pyResult.code !== 0) {
      throw new Error("Python script failed! See output above.");
    }

    // Read the JSON output
    console.log("\n  Reading output JSON...");
    const jsonText = await sandbox.fs.readTextFile("/tmp/nba_stats.json");
    const nbaStats: NbaStats = JSON.parse(jsonText);
    const playerCount = Object.keys(nbaStats).length;
    console.log(`  Got ${playerCount} players from NBA API`);

    // Show a sample of the data
    const sampleNames = Object.keys(nbaStats).slice(0, 5);
    console.log("  Sample data:");
    for (const name of sampleNames) {
      const s = nbaStats[name];
      console.log(
        `    ${name}: ${s.avgMinutes} min, ${s.gamesPlayed} GP, ${s.team}`,
      );
    }
    console.log("");

    // Step 6: Test merge (but only write to KV if --write-kv flag is set)
    console.log("Step 6/6: Testing merge logic...");
    const { players } = await getPlayers();
    console.log(`  Loaded ${players.length} existing players from KV`);

    const result = mergeNbaStats(players, nbaStats);
    console.log(`  Matched: ${result.matchedCount}`);
    console.log(`  Unmatched: ${result.unmatchedPlayers.length}`);
    console.log(`  Team changes: ${result.teamChanges.length}`);

    if (result.teamChanges.length > 0) {
      for (const change of result.teamChanges.slice(0, 5)) {
        console.log(
          `    ${change.name}: ${change.oldTeam} -> ${change.newTeam}`,
        );
      }
      if (result.teamChanges.length > 5) {
        console.log(`    ... and ${result.teamChanges.length - 5} more`);
      }
    }

    if (writeToKv) {
      console.log("\n  --write-kv flag set, saving to KV...");
      const today = new Date().toISOString().split("T")[0];
      await setPlayers(result.updatedPlayers, { playerStatsUpdated: today });
      console.log(`  Saved to KV with date ${today}`);
    } else {
      console.log("\n  Dry run (use --write-kv to actually save to KV)");
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== All steps passed! (${elapsed}s) ===`);
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("\nFailed:", error);
  Deno.exit(1);
});
