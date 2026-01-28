/**
 * Seed script for populating Deno KV with player data
 *
 * Run this script once to populate the KV database with the
 * initial player data from the hardcoded array.
 *
 * Usage: deno task seed
 */

import { PLAYER_DATA } from "../lib/players.ts";
import { setPlayers } from "../lib/players-data.ts";

console.log("🏀 Seeding Deno KV with player data...");
console.log(`   Found ${PLAYER_DATA.length} players to import`);

try {
  await setPlayers(PLAYER_DATA);
  console.log("✅ Done! Player data has been saved to KV.");
  console.log("   Run 'deno task check-kv' to verify the data.");
} catch (error) {
  console.error("❌ Failed to seed KV:", error);
  console.log("   Make sure to run with: deno run -A --unstable-kv scripts/seed-kv.ts");
  Deno.exit(1);
}
