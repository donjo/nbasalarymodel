/**
 * URL utilities for encoding/decoding app state to shareable URLs
 *
 * URL Format:
 * - tab: Active tab ("player" or "team")
 * - p: Player selections (name:games:minutes:improvement, comma-separated)
 * - t: Team codes (comma-separated)
 * - tp: Team player custom settings (name:games:minutes:improvement, comma-separated)
 */

// Player settings that can be customized via sliders
export interface PlayerSettings {
  games: number;
  minutes: number;
  improvement: number;
}

// Default values (must match those in SalaryCalculator and TeamsComparison)
export const DEFAULT_GAMES = 70;
export const DEFAULT_MINUTES = 30;
export const DEFAULT_IMPROVEMENT = 0;

// Full app state that can be encoded/decoded
export interface AppState {
  activeTab: "player" | "team" | "leaderboard";
  playerSelections: Map<string, PlayerSettings>;
  teamCodes: Set<string>;
  teamPlayerSettings: Map<string, PlayerSettings>;
}

/**
 * Check if settings differ from defaults
 */
function hasCustomSettings(settings: PlayerSettings): boolean {
  return (
    settings.games !== DEFAULT_GAMES ||
    settings.minutes !== DEFAULT_MINUTES ||
    settings.improvement !== DEFAULT_IMPROVEMENT
  );
}

/**
 * Encode a single player's settings to URL format: name:games:minutes:improvement
 */
function encodePlayerSettings(name: string, settings: PlayerSettings): string {
  return `${encodeURIComponent(name)}:${settings.games}:${settings.minutes}:${settings.improvement}`;
}

/**
 * Decode a single player's settings from URL format
 * Returns null if parsing fails
 */
function decodePlayerSettings(
  encoded: string
): { name: string; settings: PlayerSettings } | null {
  const parts = encoded.split(":");
  if (parts.length !== 4) return null;

  const name = decodeURIComponent(parts[0]);
  const games = parseInt(parts[1], 10);
  const minutes = parseInt(parts[2], 10);
  const improvement = parseFloat(parts[3]);

  // Validate parsed values
  if (
    !name ||
    isNaN(games) ||
    isNaN(minutes) ||
    isNaN(improvement) ||
    games < 1 ||
    games > 82 ||
    minutes < 0 ||
    minutes > 48 ||
    improvement < -5 ||
    improvement > 5
  ) {
    return null;
  }

  return { name, settings: { games, minutes, improvement } };
}

/**
 * Convert app state to URL search params string
 * Note: Leaderboard tab doesn't include player/team params since it's a standalone view
 */
export function encodeStateToURL(state: AppState): string {
  const params = new URLSearchParams();

  // Always include tab
  params.set("tab", state.activeTab);

  // Skip player/team params for leaderboard since it's a standalone view
  if (state.activeTab === "leaderboard") {
    return params.toString();
  }

  // Encode player selections (only if there are any)
  if (state.playerSelections.size > 0) {
    const playerStrings: string[] = [];
    state.playerSelections.forEach((settings, name) => {
      playerStrings.push(encodePlayerSettings(name, settings));
    });
    params.set("p", playerStrings.join(","));
  }

  // Encode team codes (only if there are any)
  if (state.teamCodes.size > 0) {
    params.set("t", [...state.teamCodes].join(","));
  }

  // Encode team player settings (only non-default settings)
  const customTeamSettings: string[] = [];
  state.teamPlayerSettings.forEach((settings, name) => {
    if (hasCustomSettings(settings)) {
      customTeamSettings.push(encodePlayerSettings(name, settings));
    }
  });
  if (customTeamSettings.length > 0) {
    params.set("tp", customTeamSettings.join(","));
  }

  return params.toString();
}

/**
 * Parse URL search params back to app state
 * Returns partial state - only includes what was in the URL
 */
export function decodeURLToState(search: string): Partial<AppState> {
  const params = new URLSearchParams(search);
  const result: Partial<AppState> = {};

  // Parse tab
  const tab = params.get("tab");
  if (tab === "player" || tab === "team" || tab === "leaderboard") {
    result.activeTab = tab;
  }

  // Parse player selections
  const playersParam = params.get("p");
  if (playersParam) {
    const playerSelections = new Map<string, PlayerSettings>();
    const playerStrings = playersParam.split(",");

    for (const str of playerStrings) {
      const parsed = decodePlayerSettings(str);
      if (parsed) {
        playerSelections.set(parsed.name, parsed.settings);
      }
    }

    if (playerSelections.size > 0) {
      result.playerSelections = playerSelections;
    }
  }

  // Parse team codes
  const teamsParam = params.get("t");
  if (teamsParam) {
    const codes = teamsParam.split(",").filter((code) => code.trim());
    if (codes.length > 0) {
      result.teamCodes = new Set(codes);
    }
  }

  // Parse team player settings
  const teamPlayersParam = params.get("tp");
  if (teamPlayersParam) {
    const teamPlayerSettings = new Map<string, PlayerSettings>();
    const settingsStrings = teamPlayersParam.split(",");

    for (const str of settingsStrings) {
      const parsed = decodePlayerSettings(str);
      if (parsed) {
        teamPlayerSettings.set(parsed.name, parsed.settings);
      }
    }

    if (teamPlayerSettings.size > 0) {
      result.teamPlayerSettings = teamPlayerSettings;
    }
  }

  return result;
}

/**
 * Get default settings for a player
 */
export function getDefaultSettings(): PlayerSettings {
  return {
    games: DEFAULT_GAMES,
    minutes: DEFAULT_MINUTES,
    improvement: DEFAULT_IMPROVEMENT,
  };
}
