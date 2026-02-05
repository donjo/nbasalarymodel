/**
 * Merge NBA stats into the Deno KV database
 *
 * This script reads the NBA stats JSON file (created by fetch_nba_stats.py)
 * and merges the avgMinutes and gamesPlayed data into existing player records
 * in the KV database.
 *
 * Usage: deno task merge-stats
 */

import { getPlayers, setPlayers } from "../lib/players-data.ts";
import { NICKNAME_MAP, normalizeName } from "../lib/name-utils.ts";
import { normalizeTeamCode } from "../lib/teams.ts";
import type { Player } from "../lib/types.ts";

/**
 * Stats data structure from the Python script
 */
interface NbaStats {
  [playerName: string]: {
    avgMinutes: number;
    gamesPlayed: number;
    team: string;
  };
}

/**
 * Update the fallback players.ts file with merged data
 *
 * This is necessary because Vite dev mode doesn't have access to Deno KV,
 * so we need to update the hardcoded fallback data to include avgMinutes.
 */
async function updateFallbackFile(players: Player[]) {
  const fallbackPath = new URL("../lib/players.ts", import.meta.url);

  // Generate the new file content
  const playerLines = players.map((p) => {
    const futureSalaries = JSON.stringify(p.futureSalaries);
    // Include avgMinutes and gamesPlayed if they exist
    const extras: string[] = [];
    if (p.avgMinutes !== undefined) {
      extras.push(`avgMinutes: ${p.avgMinutes}`);
    }
    if (p.gamesPlayed !== undefined) {
      extras.push(`gamesPlayed: ${p.gamesPlayed}`);
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
 * Main function to merge stats
 */
async function main() {
  console.log("🏀 Merging NBA stats into KV database...");

  // Read the stats JSON file created by the Python script
  const statsPath = new URL("./nba_stats.json", import.meta.url);
  let nbaStats: NbaStats;

  try {
    const statsText = await Deno.readTextFile(statsPath);
    nbaStats = JSON.parse(statsText);
    console.log(`   Loaded ${Object.keys(nbaStats).length} players from NBA API`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error("❌ nba_stats.json not found!");
      console.log("   Run 'python scripts/fetch_nba_stats.py' first");
      Deno.exit(1);
    }
    throw error;
  }

  // Build a lookup map with normalized names for easier matching
  const statsLookup = new Map<
    string,
    { avgMinutes: number; gamesPlayed: number; team: string }
  >();
  for (const [name, stats] of Object.entries(nbaStats)) {
    const normalized = normalizeName(name);
    // Normalize the team code from NBA API format to our app's format
    const normalizedStats = {
      ...stats,
      team: normalizeTeamCode(stats.team),
    };
    statsLookup.set(normalized, normalizedStats);

    // Also add nickname mappings so both names find the same stats
    const legalName = NICKNAME_MAP[normalized];
    if (legalName) {
      statsLookup.set(legalName, normalizedStats);
    }
  }

  // Get current players from KV
  const { players } = await getPlayers();
  console.log(`   Found ${players.length} players in KV database`);

  // Track matching results for reporting
  let matchedCount = 0;
  const unmatchedPlayers: string[] = [];
  const teamChanges: { name: string; oldTeam: string; newTeam: string }[] = [];

  // Merge stats into player records
  const updatedPlayers: Player[] = players.map((player) => {
    const normalizedName = normalizeName(player.name);
    const stats = statsLookup.get(normalizedName);

    if (stats) {
      matchedCount++;

      // Check if the player's team has changed
      if (stats.team && stats.team !== player.team) {
        teamChanges.push({
          name: player.name,
          oldTeam: player.team,
          newTeam: stats.team,
        });
      }

      return {
        ...player,
        team: stats.team || player.team, // Update team if available
        avgMinutes: stats.avgMinutes,
        gamesPlayed: stats.gamesPlayed,
      };
    } else {
      unmatchedPlayers.push(player.name);
      return player; // Keep original without new fields
    }
  });

  // Save updated players back to KV
  await setPlayers(updatedPlayers);

  // Also update the fallback file (lib/players.ts) for Vite dev mode
  // Since Vite doesn't have access to Deno KV, we need the fallback to have the data too
  await updateFallbackFile(updatedPlayers);

  // Report results
  console.log("");
  console.log(`✅ Merge complete!`);
  console.log(`   Matched: ${matchedCount} players`);
  console.log(`   Unmatched: ${unmatchedPlayers.length} players`);

  // Report team changes (trades, signings, etc.)
  if (teamChanges.length > 0) {
    console.log("");
    console.log(`🔄 Team changes detected: ${teamChanges.length}`);
    for (const change of teamChanges) {
      console.log(`   ${change.name}: ${change.oldTeam} → ${change.newTeam}`);
    }
  }

  if (unmatchedPlayers.length > 0 && unmatchedPlayers.length <= 20) {
    console.log("");
    console.log("   Unmatched players:");
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
