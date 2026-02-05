/**
 * Data layer abstraction for player data
 *
 * This module provides functions to get and set player data.
 * It tries to fetch from Deno KV first, and falls back to
 * hardcoded data if KV is empty or unavailable.
 *
 * Works identically in local development (SQLite) and on Deno Deploy.
 *
 * Note: Because the player data exceeds KV's 64KB single-value limit,
 * we store players in batches (chunks of ~100 players each).
 */

import { getKv, KV_KEYS } from "./kv.ts";
import { PLAYER_DATA } from "./players.ts";
import {
  DARKO_UPDATED,
  PLAYER_STATS_UPDATED,
  SALARY_MODEL_UPDATED,
} from "./metadata.ts";
import type { DataMetadata, Player } from "./types.ts";

// Maximum players per batch (keeps each value under 64KB limit)
const BATCH_SIZE = 100;

/**
 * Result returned by getPlayers()
 */
interface PlayersResult {
  players: Player[];
  metadata: DataMetadata;
}

/**
 * Fetches player data from KV, falls back to hardcoded data if empty
 *
 * This function first tries to get data from Deno KV. If KV isn't
 * available or is empty (like on a fresh install), it returns the
 * hardcoded player data as a fallback.
 */
export async function getPlayers(): Promise<PlayersResult> {
  // Try to get KV connection
  const kv = await getKv();

  // If KV isn't available, fall back to hardcoded data
  if (!kv) {
    return {
      players: PLAYER_DATA,
      metadata: {
        lastUpdated: "1/21/26",
        source: "fallback",
        darkoUpdated: DARKO_UPDATED,
        playerStatsUpdated: PLAYER_STATS_UPDATED,
        salaryModelUpdated: SALARY_MODEL_UPDATED,
      },
    };
  }

  // Try to get metadata first to see if we have data
  const metadataEntry = await kv.get<DataMetadata>(KV_KEYS.METADATA);

  // If no metadata, fall back to hardcoded data
  if (!metadataEntry.value) {
    return {
      players: PLAYER_DATA,
      metadata: {
        lastUpdated: "1/21/26",
        source: "fallback",
        darkoUpdated: DARKO_UPDATED,
        playerStatsUpdated: PLAYER_STATS_UPDATED,
        salaryModelUpdated: SALARY_MODEL_UPDATED,
      },
    };
  }

  // Fetch all player batches
  const players: Player[] = [];
  const batchCount = metadataEntry.value.batchCount ?? 1;

  for (let i = 0; i < batchCount; i++) {
    const batchEntry = await kv.get<Player[]>([...KV_KEYS.PLAYERS, i]);
    if (batchEntry.value) {
      players.push(...batchEntry.value);
    }
  }

  // If we got players from KV, use them
  if (players.length > 0) {
    return {
      players,
      metadata: metadataEntry.value,
    };
  }

  // Fall back to hardcoded data
  return {
    players: PLAYER_DATA,
    metadata: {
      lastUpdated: "1/21/26",
      source: "fallback",
      darkoUpdated: DARKO_UPDATED,
      playerStatsUpdated: PLAYER_STATS_UPDATED,
      salaryModelUpdated: SALARY_MODEL_UPDATED,
    },
  };
}

/**
 * Options for updating metadata when saving players
 */
interface SetPlayersOptions {
  /** Update the DARKO date (from CSV filename) */
  darkoUpdated?: string;
  /** Update the player stats date (from NBA API sync) */
  playerStatsUpdated?: string;
  /** Update the salary model date */
  salaryModelUpdated?: string;
}

/**
 * Saves player data to KV with metadata
 *
 * This function stores the player data in batches (to stay under
 * KV's 64KB limit) and updates the metadata. Existing metadata fields
 * are preserved unless explicitly updated via options.
 */
export async function setPlayers(
  players: Player[],
  options: SetPlayersOptions = {}
): Promise<void> {
  const kv = await getKv();

  if (!kv) {
    throw new Error("Deno KV is not available. Make sure to run with --unstable-kv flag.");
  }

  // Get existing metadata to preserve fields we're not updating
  const existingMetadata = await kv.get<DataMetadata>(KV_KEYS.METADATA);

  // Split players into batches
  const batches: Player[][] = [];
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    batches.push(players.slice(i, i + BATCH_SIZE));
  }

  // Build metadata, preserving existing values and applying updates
  const metadata: DataMetadata & { batchCount: number } = {
    // Preserve existing values
    ...existingMetadata.value,
    // Always update these
    lastUpdated: new Date().toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    }),
    source: "kv",
    batchCount: batches.length,
    // Apply specific updates from options
    ...(options.darkoUpdated && { darkoUpdated: options.darkoUpdated }),
    ...(options.playerStatsUpdated && { playerStatsUpdated: options.playerStatsUpdated }),
    ...(options.salaryModelUpdated && { salaryModelUpdated: options.salaryModelUpdated }),
  };

  // Store each batch separately
  for (let i = 0; i < batches.length; i++) {
    await kv.set([...KV_KEYS.PLAYERS, i], batches[i]);
  }

  // Store metadata last (so readers know data is complete)
  await kv.set(KV_KEYS.METADATA, metadata);
}
