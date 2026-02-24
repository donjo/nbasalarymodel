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
// Deno.cron is only available on Deno Deploy and when running with --unstable-cron.
// In Vite dev mode, Deno.cron doesn't exist, so we skip registration.
if (typeof Deno.cron === "function") {
  Deno.cron("update nba stats", "* * * * *", {
    backoffSchedule: [60_000, 300_000, 900_000],
  }, async () => {
    const startTime = Date.now();
    console.log("[cron] === NBA STATS UPDATE STARTING ===");

    try {
      // Step 1: Create sandbox
      console.log("[cron] Step 1/6: Creating sandbox...");
      await using sandbox = await Sandbox.create();
      console.log("[cron] Step 1/6: Sandbox created OK");

      // Step 2: Make sure Python is available
      console.log("[cron] Step 2/6: Checking Python...");
      await ensurePython(sandbox);
      console.log("[cron] Step 2/6: Python ready OK");

      // Step 3: Install the nba_api package
      console.log("[cron] Step 3/6: Installing nba_api...");
      const pipResult = await runInSandbox(sandbox, "pip", [
        "install",
        "nba_api",
      ]);
      if (pipResult.code !== 0) {
        console.log(
          `[cron] pip failed (code ${pipResult.code}), trying pip3...`,
        );
        console.log(`[cron] pip stderr: ${pipResult.stderr}`);
        const pip3Result = await runInSandbox(sandbox, "pip3", [
          "install",
          "nba_api",
        ]);
        if (pip3Result.code !== 0) {
          console.error(`[cron] pip3 stderr: ${pip3Result.stderr}`);
          throw new Error(`Failed to install nba_api: ${pip3Result.stderr}`);
        }
      }
      console.log("[cron] Step 3/6: nba_api installed OK");

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
