/**
 * Merge DARKO data into the Deno KV database
 *
 * This script reads downloaded DARKO CSV files and updates player DARKO values
 * in the KV database and fallback file.
 *
 * Workflow:
 * 1. Download CSV from https://apanalytics.shinyapps.io/DARKO/
 * 2. Save to data/darko/ folder (keeps historical downloads)
 * 3. Run this script: deno task merge-darko
 *
 * The script automatically finds the most recent CSV by date in the filename.
 *
 * Usage: deno task merge-darko
 */

import { getPlayers, setPlayers } from "../lib/players-data.ts";
import { NICKNAME_MAP, normalizeName } from "../lib/name-utils.ts";
import { parse } from "jsr:@std/csv";
import type { Player } from "../lib/types.ts";

/**
 * Find the most recent DARKO CSV file in the data/darko folder
 *
 * Files are named like: DARKO_player_talent_2026-02-05.csv
 * We extract the date from the filename and return the newest one.
 */
async function findLatestDarkoCsv(): Promise<string | null> {
  const darkoDir = new URL("../data/darko/", import.meta.url);

  // Track the best match (newest date)
  let latestFile: string | null = null;
  let latestDate: string | null = null;

  try {
    for await (const entry of Deno.readDir(darkoDir)) {
      // Look for files matching the DARKO filename pattern
      // Pattern: DARKO_player_talent_YYYY-MM-DD.csv
      const match = entry.name.match(/DARKO_player_talent_(\d{4}-\d{2}-\d{2})\.csv/);

      if (match) {
        const dateStr = match[1]; // e.g., "2026-02-05"

        // Compare dates as strings (YYYY-MM-DD sorts correctly)
        if (!latestDate || dateStr > latestDate) {
          latestDate = dateStr;
          latestFile = new URL(entry.name, darkoDir).pathname;
        }
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null; // Directory doesn't exist
    }
    throw error;
  }

  return latestFile;
}

/**
 * Update the fallback players.ts file with merged data
 *
 * This keeps the hardcoded fallback in sync with KV data, which is needed
 * because Vite dev mode doesn't have access to Deno KV.
 */
async function updateFallbackFile(players: Player[]) {
  const fallbackPath = new URL("../lib/players.ts", import.meta.url);

  // Generate the new file content, preserving all existing fields
  const playerLines = players.map((p) => {
    const futureSalaries = JSON.stringify(p.futureSalaries);

    // Build optional fields array (only include if they exist)
    const extras: string[] = [];
    if (p.avgMinutes !== undefined) {
      extras.push(`avgMinutes: ${p.avgMinutes}`);
    }
    if (p.gamesPlayed !== undefined) {
      extras.push(`gamesPlayed: ${p.gamesPlayed}`);
    }
    if (p.recentGamesPlayed !== undefined) {
      extras.push(`recentGamesPlayed: ${p.recentGamesPlayed}`);
    }
    if (p.projectedGames !== undefined) {
      extras.push(`projectedGames: ${p.projectedGames}`);
    }
    const extrasStr = extras.length > 0 ? `, ${extras.join(", ")}` : "";

    return `{ name: "${p.name}", team: "${p.team}", age: ${p.age}, darko: ${p.darko}, actualSalary: ${p.actualSalary}, futureSalaries: ${futureSalaries}${extrasStr} }`;
  });

  const fileContent = `/**
 * Fallback player data for the NBA Salary Model
 *
 * This hardcoded data is used when Deno KV is empty or unavailable.
 * In normal operation, the app fetches data from KV instead.
 */
import type { Player } from "./types.ts";

export type { Player };

export const PLAYER_DATA: Player[] = [
${playerLines.join(",\n")}
];
`;

  await Deno.writeTextFile(fallbackPath, fileContent);
  console.log("   Updated lib/players.ts fallback file");
}

/**
 * Main function to merge DARKO data
 */
async function main() {
  console.log("🏀 Merging DARKO data...");

  // 1. Find the latest CSV file
  const csvPath = await findLatestDarkoCsv();
  if (!csvPath) {
    console.error("❌ No DARKO CSV found in data/darko/");
    console.log("");
    console.log("   To update DARKO values:");
    console.log("   1. Go to https://apanalytics.shinyapps.io/DARKO/");
    console.log("   2. Click the 'Download data' button");
    console.log("   3. Save the CSV to the data/darko/ folder");
    console.log("   4. Run this script again: deno task merge-darko");
    Deno.exit(1);
  }

  // Extract the date from the filename for display
  const dateMatch = csvPath.match(/(\d{4}-\d{2}-\d{2})/);
  const csvDate = dateMatch ? dateMatch[1] : "unknown";
  console.log(`   Using: ${csvPath}`);
  console.log(`   Data date: ${csvDate}`);

  // 2. Parse the CSV file
  // The CSV has a header row with column names. We define the columns we care about
  // and skip the first row (header).
  const csvText = await Deno.readTextFile(csvPath);

  // Define column names that match the CSV header
  // Full header: nba_id,Team,Player,Experience,DPM,DPM Improvement,O-DPM,D-DPM,...
  const columns = [
    "nba_id",
    "Team",
    "Player",
    "Experience",
    "DPM",
    "DPM_Improvement",
    "O-DPM",
    "D-DPM",
    "Box_DPM",
    "Box_O-DPM",
    "Box_D-DPM",
    "FGA_100",
    "FG2_pct",
    "FG3A_100",
    "FG3_pct",
    "FG3ARate_pct",
    "RimFGA_100",
    "RimFG_pct",
    "FTA_100",
    "FT_pct",
    "FTARate_pct",
    "USG_pct",
    "REB_100",
    "AST_100",
    "AST_pct",
    "BLK_100",
    "BLK_pct",
    "STL_100",
    "STL_pct",
    "TOV_100",
  ];

  const records = parse(csvText, { skipFirstRow: true, columns }) as Record<string, string>[];
  console.log(`   Found ${records.length} players in CSV`);

  // 3. Build lookup map by normalized player name
  // The CSV has columns: nba_id, Team, Player, Experience, DPM, ...
  const darkoLookup = new Map<string, number>();
  for (const record of records) {
    const playerName = record["Player"];
    const dpmValue = record["DPM"];

    if (!playerName || !dpmValue) {
      continue; // Skip rows with missing data
    }

    const normalized = normalizeName(playerName);
    const darko = parseFloat(dpmValue);

    if (!isNaN(darko)) {
      darkoLookup.set(normalized, darko);

      // Also add nickname mappings for players known by nicknames
      const legalName = NICKNAME_MAP[normalized];
      if (legalName) {
        darkoLookup.set(legalName, darko);
      }
    }
  }

  // 4. Get current players from KV
  const { players } = await getPlayers();
  console.log(`   Found ${players.length} players in database`);

  // 5. Merge DARKO values into player records
  let matchedCount = 0;
  let updatedCount = 0;
  const unmatchedPlayers: string[] = [];
  const changes: { name: string; oldDarko: number; newDarko: number }[] = [];

  const updatedPlayers: Player[] = players.map((player) => {
    const normalizedName = normalizeName(player.name);
    const newDarko = darkoLookup.get(normalizedName);

    if (newDarko !== undefined) {
      matchedCount++;

      // Round to 2 decimal places for cleaner display
      const roundedDarko = Math.round(newDarko * 100) / 100;

      // Check if the value actually changed
      if (roundedDarko !== player.darko) {
        updatedCount++;
        changes.push({
          name: player.name,
          oldDarko: player.darko,
          newDarko: roundedDarko,
        });
        return { ...player, darko: roundedDarko };
      }
    } else {
      unmatchedPlayers.push(player.name);
    }

    return player; // No change
  });

  // 6. Save updated players to KV and fallback file
  await setPlayers(updatedPlayers);
  await updateFallbackFile(updatedPlayers);

  // 7. Report results
  console.log("");
  console.log("✅ Merge complete!");
  console.log(`   Matched: ${matchedCount} players`);
  console.log(`   Updated: ${updatedCount} players with changed DARKO values`);
  console.log(`   Unmatched: ${unmatchedPlayers.length} players`);

  // Show some example changes (top 10 by absolute change)
  if (changes.length > 0) {
    const sortedChanges = changes
      .map((c) => ({ ...c, diff: c.newDarko - c.oldDarko }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 10);

    console.log("");
    console.log("   Notable changes:");
    for (const change of sortedChanges) {
      const direction = change.diff > 0 ? "↑" : "↓";
      const diffStr = change.diff > 0 ? `+${change.diff.toFixed(2)}` : change.diff.toFixed(2);
      console.log(`     ${change.name}: ${change.oldDarko} → ${change.newDarko} (${direction} ${diffStr})`);
    }
  }

  // Show first few unmatched players if any
  if (unmatchedPlayers.length > 0 && unmatchedPlayers.length <= 20) {
    console.log("");
    console.log("   Unmatched players (no DARKO data found):");
    for (const name of unmatchedPlayers) {
      console.log(`     - ${name}`);
    }
  } else if (unmatchedPlayers.length > 20) {
    console.log("");
    console.log(`   First 20 unmatched players:`);
    for (const name of unmatchedPlayers.slice(0, 20)) {
      console.log(`     - ${name}`);
    }
    console.log(`     ... and ${unmatchedPlayers.length - 20} more`);
  }

  console.log("");
  console.log("   Run 'deno task check-kv' to verify the data");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  Deno.exit(1);
});
