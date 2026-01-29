/**
 * Shared utilities for player name matching and search
 *
 * This module handles the complexity of matching player names across different
 * data sources (NBA API, KV database, user search input) where names might have:
 * - Diacritical marks: "Nikola Jokić" vs "Nikola Jokic"
 * - Suffixes: "Jimmy Butler III" vs "Jimmy Butler"
 * - Nicknames: "Bones Hyland" vs "Nah'Shon Hyland"
 */

/**
 * Nickname to legal name mappings (both should be normalized/lowercase)
 *
 * The NBA API sometimes uses nicknames while our KV data uses legal names.
 * This map works both directions for search - users can search either way.
 */
export const NICKNAME_MAP: Record<string, string> = {
  "bones hyland": "nahshon hyland",
  "nic claxton": "nicolas claxton",
};

/**
 * Reverse mapping: legal names to nicknames
 * Built automatically from NICKNAME_MAP so users can search either direction
 */
export const LEGAL_NAME_TO_NICKNAME: Record<string, string> = Object.fromEntries(
  Object.entries(NICKNAME_MAP).map(([nickname, legal]) => [legal, nickname])
);

/**
 * Normalize a player name for matching/comparison
 *
 * This strips away formatting differences so names can be compared:
 * - "Nikola Jokić" -> "nikola jokic"
 * - "Jimmy Butler III" -> "jimmy butler"
 * - "O.G. Anunoby" -> "og anunoby"
 * - "D'Angelo Russell" -> "dangelo russell"
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD") // Decompose characters (ć -> c + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Remove combining accent marks
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, "") // Remove suffixes
    .toLowerCase()
    .replace(/\./g, "") // Remove periods (O.G. -> OG)
    .replace(/['']/g, "") // Remove apostrophes (D'Angelo -> DAngelo)
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Check if a player name matches a search term
 *
 * This is more flexible than exact matching - it handles:
 * - Accent marks: searching "Jokic" finds "Nikola Jokić"
 * - Nicknames: searching "Bones" finds "Nah'Shon Hyland"
 * - Partial matches: searching "Jimmy" finds "Jimmy Butler"
 *
 * @param playerName - The player's name from the database
 * @param searchTerm - What the user typed in the search box
 * @returns true if the player matches the search
 */
export function playerNameMatchesSearch(
  playerName: string,
  searchTerm: string
): boolean {
  const normalizedPlayer = normalizeName(playerName);
  const normalizedSearch = normalizeName(searchTerm);

  // Direct match (handles accents, suffixes, etc.)
  if (normalizedPlayer.includes(normalizedSearch)) {
    return true;
  }

  // Check if searching by nickname that maps to this player's legal name
  // e.g., searching "Bones" should find "Nah'Shon Hyland"
  for (const [nickname, legalName] of Object.entries(NICKNAME_MAP)) {
    if (nickname.includes(normalizedSearch) && normalizedPlayer.includes(legalName)) {
      return true;
    }
  }

  // Check if searching by legal name for a player known by nickname
  // e.g., searching "Nahshon" should also work
  for (const [nickname, legalName] of Object.entries(NICKNAME_MAP)) {
    if (legalName.includes(normalizedSearch) && normalizedPlayer.includes(legalName)) {
      return true;
    }
  }

  return false;
}
