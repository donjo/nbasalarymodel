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
import type { Player } from "../lib/types.ts";

/**
 * Stats data structure from the Python script
 */
interface NbaStats {
  [playerName: string]: {
    avgMinutes: number;
    gamesPlayed: number;
  };
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
  const statsLookup = new Map<string, { avgMinutes: number; gamesPlayed: number }>();
  for (const [name, stats] of Object.entries(nbaStats)) {
    const normalized = normalizeName(name);
    statsLookup.set(normalized, stats);

    // Also add nickname mappings so both names find the same stats
    const legalName = NICKNAME_MAP[normalized];
    if (legalName) {
      statsLookup.set(legalName, stats);
    }
  }

  // Get current players from KV
  const { players } = await getPlayers();
  console.log(`   Found ${players.length} players in KV database`);

  // Track matching results for reporting
  let matchedCount = 0;
  const unmatchedPlayers: string[] = [];

  // Merge stats into player records
  const updatedPlayers: Player[] = players.map((player) => {
    const normalizedName = normalizeName(player.name);
    const stats = statsLookup.get(normalizedName);

    if (stats) {
      matchedCount++;
      return {
        ...player,
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

  // Report results
  console.log("");
  console.log(`✅ Merge complete!`);
  console.log(`   Matched: ${matchedCount} players`);
  console.log(`   Unmatched: ${unmatchedPlayers.length} players`);

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
