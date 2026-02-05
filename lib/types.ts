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
 * Tracks when different data sources were last updated and where
 * the data came from (either from KV storage or the hardcoded fallback).
 */
export interface DataMetadata {
  /** @deprecated Use specific date fields instead */
  lastUpdated: string;
  source: "kv" | "fallback";
  batchCount?: number;
  /** Date of the DARKO CSV file (from filename), e.g. "2026-02-05" */
  darkoUpdated?: string;
  /** Date when player stats were last synced from NBA API */
  playerStatsUpdated?: string;
  /** Date when the salary model data was last updated */
  salaryModelUpdated?: string;
}
