/**
 * Core merge logic for NBA stats
 *
 * This module contains the pure matching/merging logic used by both
 * the manual merge script (scripts/merge-stats.ts) and the automated
 * cron job (lib/crons.ts). It takes player data and NBA stats as input,
 * and returns updated players with stats merged in.
 *
 * No file I/O, no console output, no KV access — just data transformation.
 */

import { NICKNAME_MAP, normalizeName } from "./name-utils.ts";
import { normalizeTeamCode } from "./teams.ts";
import { calculateProjectedGames, calculateSeasonProgress } from "./games.ts";
import type { Player } from "./types.ts";

/**
 * Shape of the JSON output from fetch_nba_stats.py
 *
 * Keys are player names (e.g., "LeBron James"), values contain
 * their per-game averages and participation data.
 */
export interface NbaStats {
  [playerName: string]: {
    avgMinutes: number;
    gamesPlayed: number;
    team: string;
    recentGamesPlayed: number;
  };
}

/**
 * A team change detected during the merge (trade, signing, etc.)
 */
export interface TeamChange {
  name: string;
  oldTeam: string;
  newTeam: string;
}

/**
 * Result of merging NBA stats into player records
 */
export interface MergeResult {
  updatedPlayers: Player[];
  matchedCount: number;
  unmatchedPlayers: string[];
  teamChanges: TeamChange[];
}

/**
 * Merge NBA API stats into existing player records
 *
 * This function does the heavy lifting of matching players by name
 * (handling nicknames, accents, suffixes) and merging in their
 * avgMinutes, gamesPlayed, recentGamesPlayed, and projectedGames.
 *
 * It also detects team changes (trades) by comparing the NBA API's
 * team code against what we have on file.
 *
 * @param players - Current player records from KV
 * @param nbaStats - Fresh stats from the Python script's JSON output
 * @returns MergeResult with updated players and matching diagnostics
 */
export function mergeNbaStats(
  players: Player[],
  nbaStats: NbaStats,
): MergeResult {
  // Build a lookup map with normalized names for easier matching
  const statsLookup = new Map<
    string,
    {
      avgMinutes: number;
      gamesPlayed: number;
      team: string;
      recentGamesPlayed: number;
    }
  >();

  for (const [name, stats] of Object.entries(nbaStats)) {
    const normalized = normalizeName(name);
    // Normalize the team code from NBA API format to our app's format
    const normalizedStats = {
      ...stats,
      team: normalizeTeamCode(stats.team),
    };
    statsLookup.set(normalized, normalizedStats);

    // Also add nickname mappings so both names find the same stats
    const legalName = NICKNAME_MAP[normalized];
    if (legalName) {
      statsLookup.set(legalName, normalizedStats);
    }
  }

  // Calculate season progress from all players' games played
  // This tells us how far into the season we are (e.g., 45 games in)
  const allGamesPlayed = Object.values(nbaStats).map((s) => s.gamesPlayed);
  const seasonProgress = calculateSeasonProgress(allGamesPlayed);

  // Track matching results for reporting
  let matchedCount = 0;
  const unmatchedPlayers: string[] = [];
  const teamChanges: TeamChange[] = [];

  // Merge stats into player records
  const updatedPlayers: Player[] = players.map((player) => {
    const normalizedName = normalizeName(player.name);
    const stats = statsLookup.get(normalizedName);

    if (stats) {
      matchedCount++;

      // Check if the player's team has changed
      if (stats.team && stats.team !== player.team) {
        teamChanges.push({
          name: player.name,
          oldTeam: player.team,
          newTeam: stats.team,
        });
      }

      // Calculate projected full-season games based on participation rate
      const projectedGames = calculateProjectedGames(
        stats.gamesPlayed,
        seasonProgress,
        stats.recentGamesPlayed,
      );

      return {
        ...player,
        team: stats.team || player.team,
        avgMinutes: stats.avgMinutes,
        gamesPlayed: stats.gamesPlayed,
        recentGamesPlayed: stats.recentGamesPlayed,
        projectedGames,
      };
    } else {
      unmatchedPlayers.push(player.name);
      return player;
    }
  });

  return {
    updatedPlayers,
    matchedCount,
    unmatchedPlayers,
    teamChanges,
  };
}
