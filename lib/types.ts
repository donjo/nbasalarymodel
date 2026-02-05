/**
 * Player data type for the NBA Salary Model
 *
 * This interface defines the shape of player data used throughout
 * the application, including their salary information.
 */
export interface Player {
  name: string;
  team: string;
  age: number;
  darko: number;
  actualSalary: number;
  futureSalaries: Record<string, number>;
  avgMinutes?: number;
  gamesPlayed?: number;
  recentGamesPlayed?: number;
  projectedGames?: number;
}

/**
 * Metadata about the data source
 *
 * Tracks when the data was last updated and where it came from
 * (either from KV storage or the hardcoded fallback).
 */
export interface DataMetadata {
  lastUpdated: string;
  source: "kv" | "fallback";
  batchCount?: number;
}
