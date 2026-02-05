/**
 * Debug script for inspecting Deno KV contents
 *
 * Lists all entries in the KV database to help verify
 * that data was seeded correctly.
 *
 * Usage: deno task check-kv
 */

import { getKv, KV_KEYS } from "../lib/kv.ts";
import type { DataMetadata, Player } from "../lib/types.ts";

console.log("🔍 Checking Deno KV contents...\n");

const kv = await getKv();

if (!kv) {
  console.log("❌ Deno KV is not available.");
  console.log("   Make sure to run with: deno run -A --unstable-kv scripts/check-kv.ts");
  Deno.exit(1);
}

// Check metadata
const metadataEntry = await kv.get<DataMetadata>(KV_KEYS.METADATA);
if (metadataEntry.value) {
  console.log("📋 Metadata:");
  console.log(`   Last Updated: ${metadataEntry.value.lastUpdated}`);
  console.log(`   Source: ${metadataEntry.value.source}`);
  if (metadataEntry.value.batchCount) {
    console.log(`   Batches: ${metadataEntry.value.batchCount}`);
  }
  if (metadataEntry.value.darkoUpdated) {
    console.log(`   DARKO Updated: ${metadataEntry.value.darkoUpdated}`);
  }
  if (metadataEntry.value.playerStatsUpdated) {
    console.log(`   Player Stats Updated: ${metadataEntry.value.playerStatsUpdated}`);
  }
  if (metadataEntry.value.salaryModelUpdated) {
    console.log(`   Salary Model Updated: ${metadataEntry.value.salaryModelUpdated}`);
  }
} else {
  console.log("📋 Metadata: (not found)");
}

console.log("");

// Check player batches
if (metadataEntry.value?.batchCount) {
  let totalPlayers = 0;
  const samplePlayers: Player[] = [];

  for (let i = 0; i < metadataEntry.value.batchCount; i++) {
    const batchEntry = await kv.get<Player[]>([...KV_KEYS.PLAYERS, i]);
    if (batchEntry.value) {
      totalPlayers += batchEntry.value.length;
      // Collect first 5 players for sample
      if (samplePlayers.length < 5) {
        samplePlayers.push(
          ...batchEntry.value.slice(0, 5 - samplePlayers.length),
        );
      }
    }
  }

  console.log(`🏀 Players: ${totalPlayers} total`);
  console.log("\n   Sample (first 5 players):");
  for (const player of samplePlayers) {
    console.log(
      `   - ${player.name} (${player.team}) - $${player.actualSalary}M`,
    );
  }
} else {
  // Check old single-key format (for backwards compatibility)
  const playersEntry = await kv.get<Player[]>(KV_KEYS.PLAYERS);
  if (playersEntry.value) {
    console.log(`🏀 Players: ${playersEntry.value.length} total (old format)`);
    console.log("\n   Sample (first 5 players):");
    for (const player of playersEntry.value.slice(0, 5)) {
      console.log(
        `   - ${player.name} (${player.team}) - $${player.actualSalary}M`,
      );
    }
  } else {
    console.log("🏀 Players: (not found)");
  }
}

console.log("\n✅ Check complete!");

// Close the KV connection
kv.close();
