/**
 * Scheduled cron jobs for automated data updates
 *
 * This module registers Deno.cron() jobs that run on Deno Deploy.
 * It's imported by main.ts as a side effect — the import itself
 * registers the cron schedules with the runtime.
 *
 * Currently handles:
 * - Daily NBA stats update via sandbox (runs Python script in a microVM)
 *
 * DARKO updates remain manual because the data source requires
 * interactive browser access that can't be automated with HTTP requests.
 */

import { Sandbox, Snapshot } from "@deno/sandbox";
import { mergeNbaStats } from "./merge-stats-core.ts";
import type { NbaStats } from "./merge-stats-core.ts";
import { getPlayers, setPlayers } from "./players-data.ts";

// Snapshot with Python + nba_api pre-installed (created by test-sandbox.ts --create-snapshot)
const SNAPSHOT_SLUG = "nba-stats-python";

/**
 * Run a command inside a sandbox and return the output
 */
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
 * Install Python dependencies via apt-get + pip
 *
 * Only needed when no snapshot is available. The snapshot has
 * everything pre-installed so this step is skipped.
 */
async function installDeps(sandbox: Sandbox): Promise<void> {
  // Install pip via apt-get (the sandbox has Python but not pip)
  console.log("[cron] Installing python3-pip via apt-get...");
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

  // Install nba_api via pip
  console.log("[cron] Installing nba_api via pip...");
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
}

// Deno.cron is only available on Deno Deploy and when running with --unstable-cron.
// In Vite dev mode, Deno.cron doesn't exist, so we skip registration.
if (typeof Deno.cron === "function") {
  Deno.cron("update nba stats", "0 10,22 * * *", {
    backoffSchedule: [60_000, 300_000, 900_000],
  }, async () => {
    const startTime = Date.now();
    console.log("[cron] === NBA STATS UPDATE STARTING ===");

    try {
      // Step 1: Create sandbox (use snapshot if available for faster startup)
      console.log("[cron] Step 1/6: Creating sandbox...");
      const snapshot = await Snapshot.get(SNAPSHOT_SLUG);
      let needsInstall = true;

      if (snapshot) {
        console.log(`[cron] Using snapshot "${SNAPSHOT_SLUG}"`);
      } else {
        console.log("[cron] No snapshot found, using fresh sandbox");
      }

      await using sandbox = await Sandbox.create(
        snapshot ? { root: SNAPSHOT_SLUG } : undefined,
      );
      if (snapshot) needsInstall = false;
      console.log("[cron] Step 1/6: Sandbox created OK");

      // Step 2: Verify Python
      console.log("[cron] Step 2/6: Checking Python...");
      const pyCheck = await runInSandbox(sandbox, "python3", ["--version"]);
      if (pyCheck.code !== 0) {
        throw new Error("Python 3 not found in sandbox");
      }
      console.log(`[cron] Step 2/6: ${pyCheck.stdout.trim()} OK`);

      // Step 3: Install deps if needed (skipped when using snapshot)
      if (needsInstall) {
        console.log("[cron] Step 3/6: Installing dependencies...");
        await installDeps(sandbox);
        console.log("[cron] Step 3/6: Dependencies installed OK");
      } else {
        console.log("[cron] Step 3/6: Dependencies in snapshot, skipping");
      }

      // Step 4: Upload the Python script into the sandbox
      console.log("[cron] Step 4/6: Uploading Python script...");
      const scriptContent = await Deno.readTextFile(
        new URL("../scripts/fetch_nba_stats.py", import.meta.url),
      );
      console.log(
        `[cron] Read script from bundle: ${scriptContent.length} chars`,
      );
      await sandbox.fs.writeTextFile(
        "/tmp/fetch_nba_stats.py",
        scriptContent,
      );
      console.log("[cron] Step 4/6: Script uploaded OK");

      // Step 5: Run the Python script and read output
      console.log("[cron] Step 5/6: Running fetch_nba_stats.py...");
      const pyResult = await runInSandbox(sandbox, "python3", [
        "/tmp/fetch_nba_stats.py",
      ]);
      console.log(`[cron] Python exit code: ${pyResult.code}`);
      console.log(`[cron] Python stdout: ${pyResult.stdout}`);
      if (pyResult.stderr) {
        console.log(`[cron] Python stderr: ${pyResult.stderr}`);
      }

      if (pyResult.code !== 0) {
        throw new Error(
          `Python script failed (exit ${pyResult.code}): ${pyResult.stderr}`,
        );
      }

      const jsonText = await sandbox.fs.readTextFile("/tmp/nba_stats.json");
      const nbaStats: NbaStats = JSON.parse(jsonText);
      const playerCount = Object.keys(nbaStats).length;
      console.log(`[cron] Step 5/6: Fetched ${playerCount} players OK`);

      if (playerCount < 400) {
        throw new Error(
          `Only got ${playerCount} players (expected 400+). NBA API may be returning partial data.`,
        );
      }

      // Step 6: Merge into KV
      console.log("[cron] Step 6/6: Merging into KV...");
      const { players } = await getPlayers();
      console.log(`[cron] Loaded ${players.length} existing players from KV`);

      const result = mergeNbaStats(players, nbaStats);
      console.log(
        `[cron] Merge result: ${result.matchedCount} matched, ` +
          `${result.unmatchedPlayers.length} unmatched`,
      );

      const today = new Date().toISOString().split("T")[0];
      await setPlayers(result.updatedPlayers, { playerStatsUpdated: today });
      console.log(`[cron] Step 6/6: Saved to KV with date ${today} OK`);

      if (result.teamChanges.length > 0) {
        console.log(`[cron] Team changes: ${result.teamChanges.length}`);
        for (const change of result.teamChanges) {
          console.log(
            `[cron]   ${change.name}: ${change.oldTeam} -> ${change.newTeam}`,
          );
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[cron] === NBA STATS UPDATE COMPLETE (${elapsed}s) ===`);
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[cron] === NBA STATS UPDATE FAILED (${elapsed}s) ===`);
      console.error(`[cron] Error: ${error}`);
      if (error instanceof Error) {
        console.error(`[cron] Stack: ${error.stack}`);
      }
      throw error;
    }
  });
}
