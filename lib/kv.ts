/**
 * Deno KV connection with lazy initialization
 *
 * Opens a connection to Deno KV that works in both environments:
 * - Local development: Uses SQLite stored at the default location
 * - Deno Deploy: Uses the distributed KV database automatically
 *
 * The connection is created lazily on first use to avoid errors
 * when running in environments where KV isn't available (like Vite SSR).
 */

let kvInstance: Deno.Kv | null = null;

/**
 * Gets the KV connection, creating it if needed
 *
 * Returns null if KV isn't available (e.g., in Vite dev mode
 * where the unstable API isn't enabled).
 */
export async function getKv(): Promise<Deno.Kv | null> {
  if (kvInstance) {
    return kvInstance;
  }

  // Try to open KV - this may fail in dev mode if --unstable-kv isn't set
  try {
    if (typeof Deno.openKv === "function") {
      kvInstance = await Deno.openKv();
      return kvInstance;
    }
  } catch (error) {
    console.warn("Deno KV not available, falling back to hardcoded data:", error);
  }

  return null;
}

/**
 * Key constants for consistent access
 *
 * Using constants helps prevent typos and makes it easy
 * to see all the keys used in the application.
 */
export const KV_KEYS = {
  // Stores all player data in batches
  PLAYERS: ["players", "all_data"],
  // Stores metadata about the data (last updated, source, etc.)
  METADATA: ["metadata", "stats"],
} as const;
