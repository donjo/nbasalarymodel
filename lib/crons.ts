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

import { Sandbox } from "@deno/sandbox";
import { mergeNbaStats } from "./merge-stats-core.ts";
import type { NbaStats } from "./merge-stats-core.ts";
import { getPlayers, setPlayers } from "./players-data.ts";

/**
 * Run a command inside a sandbox and return the output
 *
 * This is a helper that spawns a process, waits for it to finish,
 * and returns the decoded stdout/stderr along with the exit code.
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
 * Ensure Python 3 and pip are available in the sandbox
 *
 * The sandbox microVM includes a Linux environment, but we need
 * to verify Python is installed. If not, we try installing it.
 */
async function ensurePython(sandbox: Sandbox): Promise<void> {
  const check = await runInSandbox(sandbox, "python3", ["--version"]);
  if (check.code === 0) {
    console.log(`[cron] Python available: ${check.stdout.trim()}`);
    return;
  }

  // Python not found — try installing it
  console.log("[cron] Python not found, installing...");
  const install = await runInSandbox(sandbox, "apt-get", [
    "update",
    "-qq",
  ]);
  if (install.code !== 0) {
    throw new Error(`Failed to update apt: ${install.stderr}`);
  }

  const installPy = await runInSandbox(sandbox, "apt-get", [
    "install",
    "-y",
    "-qq",
    "python3",
    "python3-pip",
  ]);
  if (installPy.code !== 0) {
    throw new Error(`Failed to install Python: ${installPy.stderr}`);
  }

  console.log("[cron] Python installed successfully");
}

/**
 * Daily NBA stats update cron job
 *
 * Runs at 10:00 AM UTC (5:00 AM Eastern) — after NBA games finish
 * for the night so stats are fresh.
 *
 * Steps:
 * 1. Spin up a sandbox (Linux microVM)
 * 2. Install Python + nba_api inside it
 * 3. Upload and run fetch_nba_stats.py
 * 4. Read the output JSON
 * 5. Merge stats into KV using the shared merge function
 */
Deno.cron("update nba stats", "0 10 * * *", {
  backoffSchedule: [60_000, 300_000, 900_000],
}, async () => {
  console.log("[cron] Starting NBA stats update...");

  // Create a sandbox — "await using" ensures cleanup when done
  await using sandbox = await Sandbox.create();

  // Step 1: Make sure Python is available
  await ensurePython(sandbox);

  // Step 2: Install the nba_api package
  console.log("[cron] Installing nba_api...");
  const pipResult = await runInSandbox(sandbox, "pip", [
    "install",
    "nba_api",
  ]);
  if (pipResult.code !== 0) {
    // Some sandbox images use pip3 instead of pip
    const pip3Result = await runInSandbox(sandbox, "pip3", [
      "install",
      "nba_api",
    ]);
    if (pip3Result.code !== 0) {
      throw new Error(`Failed to install nba_api: ${pip3Result.stderr}`);
    }
  }
  console.log("[cron] nba_api installed");

  // Step 3: Upload the Python script into the sandbox
  // Read it from the deployment bundle (it's part of the deployed files)
  const scriptContent = await Deno.readTextFile(
    new URL("../scripts/fetch_nba_stats.py", import.meta.url),
  );
  await sandbox.fs.writeTextFile("/tmp/fetch_nba_stats.py", scriptContent);

  // Step 4: Run the Python script
  // The script saves its output to the same directory as itself,
  // so the JSON will be at /tmp/nba_stats.json
  console.log("[cron] Running fetch_nba_stats.py...");
  const pyResult = await runInSandbox(sandbox, "python3", [
    "/tmp/fetch_nba_stats.py",
  ]);

  if (pyResult.code !== 0) {
    throw new Error(
      `Python script failed (exit ${pyResult.code}): ${pyResult.stderr}`,
    );
  }
  console.log(`[cron] Python output: ${pyResult.stdout.trim()}`);

  // Step 5: Read the JSON output from the sandbox
  const jsonText = await sandbox.fs.readTextFile("/tmp/nba_stats.json");
  const nbaStats: NbaStats = JSON.parse(jsonText);
  const playerCount = Object.keys(nbaStats).length;
  console.log(`[cron] Fetched stats for ${playerCount} players`);

  // Sanity check — the NBA has ~500+ active players
  if (playerCount < 400) {
    throw new Error(
      `Only got ${playerCount} players (expected 400+). NBA API may be returning partial data.`,
    );
  }

  // Step 6: Merge into KV using the shared merge function
  const { players } = await getPlayers();
  console.log(`[cron] Merging with ${players.length} existing players...`);

  const result = mergeNbaStats(players, nbaStats);

  // Save to KV with today's date
  const today = new Date().toISOString().split("T")[0];
  await setPlayers(result.updatedPlayers, { playerStatsUpdated: today });

  // Log results
  console.log(
    `[cron] Merge complete: ${result.matchedCount} matched, ` +
      `${result.unmatchedPlayers.length} unmatched`,
  );
  if (result.teamChanges.length > 0) {
    console.log(`[cron] Team changes: ${result.teamChanges.length}`);
    for (const change of result.teamChanges) {
      console.log(
        `[cron]   ${change.name}: ${change.oldTeam} -> ${change.newTeam}`,
      );
    }
  }

  console.log("[cron] NBA stats update complete!");
});
