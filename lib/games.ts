/**
 * Games projection utilities
 *
 * These functions help calculate projected full-season games based on
 * a player's participation rate so far this season. This accounts for
 * injuries and rest without requiring explicit injury data.
 *
 * The algorithm is "optimistic" for players who are currently healthy:
 * - If a player has played most of the last 10 games, we assume they'll
 *   continue playing at that rate for the rest of the season
 * - This helps players who were injured early but have returned
 *
 * Example (optimistic):
 * - Aaron Gordon: 23/53 season games, but 9/10 recent games
 * - Remaining games: 82 - 53 = 29
 * - Projected remaining: 29 × (9/10) = 26 games
 * - Total projected: 23 + 26 = 49 games (vs 36 with pure season rate)
 */

/**
 * Total games in an NBA regular season
 */
export const TOTAL_SEASON_GAMES = 82;

/**
 * How many recent league game dates we track
 * Note: This is league-wide dates, not team games. In a 10-day window,
 * each team only plays about 4-6 games due to rest days.
 */
export const RECENT_GAMES_WINDOW = 10;

/**
 * Minimum recent games played to be considered "currently healthy"
 * Since teams play about 4-6 games in a 10-day window, a threshold
 * of 5 means the player has played most available games recently.
 */
export const HEALTHY_THRESHOLD = 5;

/**
 * Calculate how far into the season we are based on max games played
 *
 * This finds the player with the most games played, which tells us
 * approximately how many games have been played in the season so far.
 *
 * @param allGamesPlayed - Array of games played values for all players
 * @returns The maximum number of games played (at least 1 to avoid division by zero)
 */
export function calculateSeasonProgress(allGamesPlayed: number[]): number {
  // Filter out undefined/null values and find the maximum
  const validGames = allGamesPlayed.filter((g) => g !== undefined && g !== null);
  if (validGames.length === 0) return 1;
  return Math.max(...validGames, 1);
}

/**
 * Assumed participation rate for healthy players going forward
 * A healthy NBA player typically plays about 90% of remaining games
 * (accounting for occasional rest days)
 */
const HEALTHY_FORWARD_RATE = 0.9;

/**
 * Project full-season games based on a player's participation
 *
 * Uses an "optimistic" algorithm for players who are currently healthy:
 * - If they've played 5+ of the last 10 league game dates, they're healthy
 * - For healthy players, project forward assuming they play 90% of remaining games
 * - Use the HIGHER of season-rate and optimistic projections
 *
 * This helps players who were injured early but have returned:
 * - Aaron Gordon: 23/53 season games, but playing now → projects ~49 games
 * - vs pure season rate which would give ~36 games
 *
 * @param gamesPlayed - How many games the player has played this season
 * @param seasonProgress - How many games have been played in the season
 * @param recentGamesPlayed - How many of the last 10 game dates they've played (optional)
 * @returns Projected full-season games (rounded to nearest integer)
 */
export function calculateProjectedGames(
  gamesPlayed: number,
  seasonProgress: number,
  recentGamesPlayed?: number
): number {
  // Handle edge cases
  if (seasonProgress <= 0) return TOTAL_SEASON_GAMES;
  if (gamesPlayed <= 0) return 0;

  // Standard projection: use season-long participation rate
  const participationRate = gamesPlayed / seasonProgress;
  const seasonRateProjection = Math.round(participationRate * TOTAL_SEASON_GAMES);

  // Check if player is "currently healthy" (played most recent games)
  const isCurrentlyHealthy =
    recentGamesPlayed !== undefined && recentGamesPlayed >= HEALTHY_THRESHOLD;

  if (isCurrentlyHealthy) {
    // Optimistic projection: assume they play 90% of remaining games
    // This helps players who missed time early but are back now
    const remainingGames = TOTAL_SEASON_GAMES - seasonProgress;
    const projectedRemaining = remainingGames * HEALTHY_FORWARD_RATE;
    const optimisticProjection = Math.round(gamesPlayed + projectedRemaining);

    // Use the higher of the two projections
    // This ensures we don't penalize healthy players with good season rates
    return Math.max(seasonRateProjection, optimisticProjection);
  }

  // Not currently healthy - use season rate only
  return seasonRateProjection;
}
