/**
 * Leaderboard Island - Shows top 10 most overvalued/undervalued players and teams
 *
 * Surplus = Projected Value - Actual Salary
 * - Positive surplus = player is undervalued (team getting good value)
 * - Negative surplus = player is overvalued (team overpaying)
 */

import type { Player } from "../lib/players.ts";
import { calculateSalary } from "../lib/salary.ts";
import { getTeamFullName } from "../lib/teams.ts";

// Default settings for calculating surplus (same as TeamsComparison uses)
const DEFAULT_GAMES = 70;
const DEFAULT_MINUTES = 30;
const DEFAULT_IMPROVEMENT = 0;

interface Props {
  players: Player[];
}

// Calculate surplus for a single player using default settings
function calculatePlayerSurplus(player: Player): number {
  // Skip free agents (no actual salary)
  if (player.actualSalary === 0) return 0;

  const projected = calculateSalary(
    DEFAULT_GAMES,
    DEFAULT_MINUTES,
    player.darko,
    DEFAULT_IMPROVEMENT
  );

  // Handle "Minimum Salary" case - assume minimum is ~$2M
  const projectedValue = projected === "Minimum Salary" ? 2.0 : parseFloat(projected);
  return projectedValue - player.actualSalary;
}

// Format surplus value with +$ or -$ prefix
function formatSurplus(surplus: number): string {
  if (surplus >= 0) {
    return `+$${surplus.toFixed(1)}M`;
  }
  return `-$${Math.abs(surplus).toFixed(1)}M`;
}

// Build URL for a player link (uses default settings)
function getPlayerUrl(playerName: string): string {
  const encoded = encodeURIComponent(playerName);
  return `?tab=player&p=${encoded}:${DEFAULT_GAMES}:${DEFAULT_MINUTES}:${DEFAULT_IMPROVEMENT}`;
}

export default function Leaderboard({ players }: Props) {
  // Filter out free agents and calculate surplus for each player
  const playersWithSurplus = players
    .filter((p) => p.actualSalary > 0)
    .map((p) => ({
      player: p,
      surplus: calculatePlayerSurplus(p),
    }));

  // Sort for most overvalued (most negative surplus)
  const mostOvervalued = [...playersWithSurplus]
    .sort((a, b) => a.surplus - b.surplus)
    .slice(0, 10);

  // Sort for most undervalued (most positive surplus)
  const mostUndervalued = [...playersWithSurplus]
    .sort((a, b) => b.surplus - a.surplus)
    .slice(0, 10);

  // Calculate team totals by grouping players
  // Use the full team name to handle alternate codes (BKN/BRK, CHO/CHA)
  const teamSurplusMap = new Map<string, { code: string; totalSurplus: number; playerCount: number }>();

  playersWithSurplus.forEach(({ player, surplus }) => {
    const fullName = getTeamFullName(player.team);
    const existing = teamSurplusMap.get(fullName);
    if (existing) {
      existing.totalSurplus += surplus;
      existing.playerCount += 1;
    } else {
      teamSurplusMap.set(fullName, {
        code: player.team,
        totalSurplus: surplus,
        playerCount: 1,
      });
    }
  });

  const teamsWithSurplus = Array.from(teamSurplusMap.entries()).map(
    ([name, data]) => ({
      name,
      code: data.code,
      totalSurplus: data.totalSurplus,
      playerCount: data.playerCount,
    })
  );

  // Most overvalued teams (most negative total surplus)
  const mostOvervaluedTeams = [...teamsWithSurplus]
    .sort((a, b) => a.totalSurplus - b.totalSurplus)
    .slice(0, 10);

  // Most undervalued teams (most positive total surplus)
  const mostUndervaluedTeams = [...teamsWithSurplus]
    .sort((a, b) => b.totalSurplus - a.totalSurplus)
    .slice(0, 10);

  return (
    <div class="leaderboard-container">
      <div class="leaderboard-grid">
        {/* Most Overvalued Players */}
        <div class="leaderboard-table">
          <div class="leaderboard-table-header">
            <h3 class="leaderboard-table-title">Most Overvalued Players</h3>
            <span class="leaderboard-table-subtitle">Highest negative surplus</span>
          </div>
          <div class="leaderboard-table-body">
            {mostOvervalued.map((item, index) => (
              <a
                key={item.player.name}
                href={getPlayerUrl(item.player.name)}
                class="leaderboard-row leaderboard-row-link"
              >
                <span class="leaderboard-rank">{index + 1}</span>
                <div class="leaderboard-info">
                  <span class="leaderboard-name">{item.player.name}</span>
                  <span class="leaderboard-team">{item.player.team}</span>
                </div>
                <span class={`leaderboard-surplus ${item.surplus >= 0 ? "surplus-positive" : "surplus-negative"}`}>
                  {formatSurplus(item.surplus)}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Most Undervalued Players */}
        <div class="leaderboard-table">
          <div class="leaderboard-table-header">
            <h3 class="leaderboard-table-title">Most Undervalued Players</h3>
            <span class="leaderboard-table-subtitle">Highest positive surplus</span>
          </div>
          <div class="leaderboard-table-body">
            {mostUndervalued.map((item, index) => (
              <a
                key={item.player.name}
                href={getPlayerUrl(item.player.name)}
                class="leaderboard-row leaderboard-row-link"
              >
                <span class="leaderboard-rank">{index + 1}</span>
                <div class="leaderboard-info">
                  <span class="leaderboard-name">{item.player.name}</span>
                  <span class="leaderboard-team">{item.player.team}</span>
                </div>
                <span class={`leaderboard-surplus ${item.surplus >= 0 ? "surplus-positive" : "surplus-negative"}`}>
                  {formatSurplus(item.surplus)}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Most Overvalued Teams */}
        <div class="leaderboard-table">
          <div class="leaderboard-table-header">
            <h3 class="leaderboard-table-title">Most Overvalued Teams</h3>
            <span class="leaderboard-table-subtitle">Highest negative total surplus</span>
          </div>
          <div class="leaderboard-table-body">
            {mostOvervaluedTeams.map((item, index) => (
              <a
                key={item.name}
                href={`?tab=team&t=${item.code}`}
                class="leaderboard-row leaderboard-row-link"
              >
                <span class="leaderboard-rank">{index + 1}</span>
                <div class="leaderboard-info">
                  <span class="leaderboard-name">{item.name}</span>
                  <span class="leaderboard-team">{item.code}</span>
                </div>
                <span class={`leaderboard-surplus ${item.totalSurplus >= 0 ? "surplus-positive" : "surplus-negative"}`}>
                  {formatSurplus(item.totalSurplus)}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Most Undervalued Teams */}
        <div class="leaderboard-table">
          <div class="leaderboard-table-header">
            <h3 class="leaderboard-table-title">Most Undervalued Teams</h3>
            <span class="leaderboard-table-subtitle">Highest positive total surplus</span>
          </div>
          <div class="leaderboard-table-body">
            {mostUndervaluedTeams.map((item, index) => (
              <a
                key={item.name}
                href={`?tab=team&t=${item.code}`}
                class="leaderboard-row leaderboard-row-link"
              >
                <span class="leaderboard-rank">{index + 1}</span>
                <div class="leaderboard-info">
                  <span class="leaderboard-name">{item.name}</span>
                  <span class="leaderboard-team">{item.code}</span>
                </div>
                <span class={`leaderboard-surplus ${item.totalSurplus >= 0 ? "surplus-positive" : "surplus-negative"}`}>
                  {formatSurplus(item.totalSurplus)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
