/**
 * TeamsComparison Island - Compare NBA team rosters and payrolls
 * Receives teamPlayerSettings from parent for URL-shareable state
 */

import { useState } from "preact/hooks";
import { PlusIcon, TrashIcon } from "../components/Icons.tsx";
import type { Player } from "../lib/players.ts";
import { getTeamFullName } from "../lib/teams.ts";
import {
  calculateSalary,
  getDarkoLabel,
  getAgingDelta,
  INFLATION_SCALERS,
  FUTURE_YEARS,
} from "../lib/salary.ts";
import {
  type PlayerSettings,
  DEFAULT_GAMES,
  getPlayerDefaults,
} from "../lib/url.ts";

interface Props {
  players: Player[];
  featuredTeamCodes?: string[];
  addedTeamCodes: Set<string>;
  onTeamAdded: (code: string) => void;
  onTeamRemoved: (code: string) => void;
  teamPlayerSettings: Map<string, PlayerSettings>;
  onTeamPlayerSettingsChange: (name: string, settings: PlayerSettings) => void;
}

// Format salary as currency (e.g., "$25.5M")
function formatSalary(salary: number): string {
  return `$${salary.toFixed(1)}M`;
}

// Calculate a player's projected contract value using the salary model
function getProjectedValue(player: Player, settings?: PlayerSettings): number {
  const resolved = getPlayerDefaults(player, settings);

  const result = calculateSalary(resolved.games, resolved.minutes, player.darko, resolved.improvement);
  // "Minimum Salary" returns as a string, treat as ~2M for calculation purposes
  if (result === "Minimum Salary") return 2.0;
  return parseFloat(result);
}

export default function TeamsComparison({
  players,
  featuredTeamCodes = [],
  addedTeamCodes,
  onTeamAdded,
  onTeamRemoved,
  teamPlayerSettings,
  onTeamPlayerSettingsChange,
}: Props) {
  // Selected teams - derived from addedTeamCodes
  const selectedTeams = [...addedTeamCodes];

  // Get players for a specific team, sorted by salary (highest first)
  const getTeamRoster = (teamCode: string): Player[] => {
    // Handle alternate codes (BKN/BRK both map to Brooklyn Nets)
    const teamName = getTeamFullName(teamCode);

    return players
      .filter((p) => getTeamFullName(p.team) === teamName)
      .sort((a, b) => b.actualSalary - a.actualSalary);
  };

  // Calculate total payroll for a team
  const getTeamPayroll = (teamCode: string): number => {
    const roster = getTeamRoster(teamCode);
    return roster.reduce((total, player) => total + player.actualSalary, 0);
  };

  // Calculate total projected value for a team
  const getTeamTotalValue = (teamCode: string): number => {
    const roster = getTeamRoster(teamCode);
    return roster.reduce((total, player) => total + getProjectedValue(player), 0);
  };

  // Add a team to the comparison
  const addTeam = (teamCode: string) => {
    onTeamAdded(teamCode);
  };

  // Remove a team from the comparison
  const removeTeam = (teamCode: string) => {
    onTeamRemoved(teamCode);
  };

  // Filter out featured teams that are already selected
  const availableFeatured = featuredTeamCodes.filter(
    (code) => !addedTeamCodes.has(code)
  );

  // Check if we're in comparison mode (at least one team selected)
  const isComparisonMode = selectedTeams.length > 0;

  return (
    <>
      {/* Team Cards Grid (comparison mode) */}
      {isComparisonMode && (
        <div class="player-grid">
          {selectedTeams.map((teamCode) => (
            <TeamCard
              key={teamCode}
              teamCode={teamCode}
              roster={getTeamRoster(teamCode)}
              totalPayroll={getTeamPayroll(teamCode)}
              onRemove={() => removeTeam(teamCode)}
              playerSettings={teamPlayerSettings}
              onPlayerSettingsChange={onTeamPlayerSettingsChange}
            />
          ))}
        </div>
      )}

      {/* Empty state with featured teams */}
      {!isComparisonMode && (
        <div class="featured-section">
          <div class="featured-header">
            <h2 class="featured-title">Featured Teams</h2>
            <p class="featured-subtitle">
              Click "Add" to start comparing team rosters
            </p>
          </div>
          <div class="preview-grid">
            {availableFeatured.map((teamCode) => (
              <TeamPreviewCard
                key={teamCode}
                teamCode={teamCode}
                totalPayroll={getTeamPayroll(teamCode)}
                totalValue={getTeamTotalValue(teamCode)}
                onAdd={() => addTeam(teamCode)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Team preview card component - shows team totals without roster
interface TeamPreviewCardProps {
  teamCode: string;
  totalPayroll: number;
  totalValue: number;
  onAdd: () => void;
}

function TeamPreviewCard({ teamCode, totalPayroll, totalValue, onAdd }: TeamPreviewCardProps) {
  const surplus = totalValue - totalPayroll;

  return (
    <div class="preview-card">
      <button onClick={onAdd} class="preview-add-btn" title="Add to comparison">
        <PlusIcon size={14} />
        Add
      </button>

      <h3 class="preview-card-title">{getTeamFullName(teamCode)}</h3>
      <div class="preview-card-meta">{teamCode}</div>

      <div class="preview-stats">
        <div class="preview-stat">
          <span class="preview-stat-label">Total Payroll</span>
          <span class="preview-stat-value">{formatSalary(totalPayroll)}</span>
        </div>
        <div class="preview-stat">
          <span class="preview-stat-label">Total Value</span>
          <span class="preview-stat-value">
            {formatSalary(totalValue)}
          </span>
        </div>
        <div class="preview-stat preview-stat-surplus">
          <span class="preview-stat-label">Surplus</span>
          <span
            class={`preview-stat-value ${
              surplus >= 0 ? "surplus-positive" : "surplus-negative"
            }`}
          >
            {surplus >= 0 ? "+" : ""}{formatSalary(surplus)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Sort options for the roster table
type SortField = "salary" | "value" | "surplus";

interface TeamCardProps {
  teamCode: string;
  roster: Player[];
  totalPayroll: number;
  onRemove: () => void;
  playerSettings: Map<string, PlayerSettings>;
  onPlayerSettingsChange: (name: string, settings: PlayerSettings) => void;
}

function TeamCard({
  teamCode,
  roster,
  totalPayroll,
  onRemove,
  playerSettings,
  onPlayerSettingsChange,
}: TeamCardProps) {
  // Sort state - default to salary (highest first)
  const [sortBy, setSortBy] = useState<SortField>("salary");

  // Track which player is expanded (null = none)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Get settings for a player (returns custom settings or player defaults)
  const getSettings = (player: Player): PlayerSettings => {
    return playerSettings.get(player.name) || getPlayerDefaults(player);
  };

  // Update settings for a player (calls parent callback)
  const updateSettings = (playerName: string, newSettings: PlayerSettings) => {
    onPlayerSettingsChange(playerName, newSettings);
  };

  // Calculate total projected value and surplus for the team (using custom settings)
  const totalValue = roster.reduce(
    (sum, player) => sum + getProjectedValue(player, getSettings(player)),
    0
  );
  const totalSurplus = totalValue - totalPayroll;

  // Sort the roster based on current sort field (using custom settings)
  const sortedRoster = [...roster].sort((a, b) => {
    const aValue = getProjectedValue(a, getSettings(a));
    const bValue = getProjectedValue(b, getSettings(b));
    const aSurplus = aValue - a.actualSalary;
    const bSurplus = bValue - b.actualSalary;

    switch (sortBy) {
      case "salary":
        return b.actualSalary - a.actualSalary;
      case "value":
        return bValue - aValue;
      case "surplus":
        return bSurplus - aSurplus;
      default:
        return 0;
    }
  });

  // Toggle player expansion
  const togglePlayer = (playerName: string) => {
    setExpandedPlayer(expandedPlayer === playerName ? null : playerName);
  };

  return (
    <div class="player-card team-card">
      {/* Header with team name and remove button */}
      <div class="player-card-header">
        <h2 class="player-card-title">{getTeamFullName(teamCode)}</h2>
        <button onClick={onRemove} class="remove-btn">
          <TrashIcon size={16} />
        </button>
      </div>

      {/* Team summary: payroll, value, and surplus */}
      <div class="team-summary">
        <div class="team-stat">
          <span class="team-stat-label">Total Payroll</span>
          <span class="team-stat-value">{formatSalary(totalPayroll)}</span>
        </div>
        <div class="team-stat">
          <span class="team-stat-label">Total Value</span>
          <span class="team-stat-value team-stat-value-blue">{formatSalary(totalValue)}</span>
        </div>
        <div class="team-stat">
          <span class="team-stat-label">Surplus</span>
          <span class={`team-stat-value ${totalSurplus >= 0 ? "surplus-positive" : "surplus-negative"}`}>
            {totalSurplus >= 0 ? "+" : ""}{formatSalary(totalSurplus)}
          </span>
        </div>
      </div>

      {/* Roster table */}
      <div class="roster-section">
        <div class="roster-header">
          <span>Player</span>
          <button
            class={`roster-header-btn ${sortBy === "salary" ? "active" : ""}`}
            onClick={() => setSortBy("salary")}
          >
            Salary {sortBy === "salary" && "▼"}
          </button>
          <button
            class={`roster-header-btn ${sortBy === "value" ? "active" : ""}`}
            onClick={() => setSortBy("value")}
          >
            Value {sortBy === "value" && "▼"}
          </button>
          <button
            class={`roster-header-btn ${sortBy === "surplus" ? "active" : ""}`}
            onClick={() => setSortBy("surplus")}
          >
            +/- {sortBy === "surplus" && "▼"}
          </button>
        </div>
        <div class="roster-table">
          {sortedRoster.map((player) => {
            const settings = getSettings(player);
            const projectedValue = getProjectedValue(player, settings);
            const surplus = projectedValue - player.actualSalary;
            const isPositive = surplus >= 0;
            const isExpanded = expandedPlayer === player.name;

            return (
              <div key={player.name}>
                <div
                  class={`roster-row ${isExpanded ? "roster-row-expanded" : ""}`}
                  onClick={() => togglePlayer(player.name)}
                >
                  <span class="roster-player-name roster-player-clickable">
                    <span class="roster-arrow">{isExpanded ? "▼" : "▶"}</span> {player.name}
                    <span class={`roster-player-settings ${settings.games !== (player.projectedGames ?? DEFAULT_GAMES) || settings.minutes !== (player.avgMinutes ?? 0) ? "roster-player-settings-modified" : ""}`}>
                      G — {settings.games} · MP — {settings.minutes}
                    </span>
                  </span>
                  <span class="roster-salary">{formatSalary(player.actualSalary)}</span>
                  <span class={`roster-value ${isPositive ? "surplus-positive" : "surplus-negative"}`}>
                    {formatSalary(projectedValue)}
                  </span>
                  <span class={`roster-surplus ${isPositive ? "surplus-positive" : "surplus-negative"}`}>
                    {isPositive ? "+" : ""}{formatSalary(surplus)}
                  </span>
                </div>
                {isExpanded && (
                  <ExpandedPlayerView
                    player={player}
                    settings={settings}
                    onSettingsChange={(newSettings) => updateSettings(player.name, newSettings)}
                  />
                )}
              </div>
            );
          })}
          {sortedRoster.length === 0 && (
            <div class="roster-empty">No players found for this team</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Expanded player view with sliders and multi-year projections
interface ExpandedPlayerViewProps {
  player: Player;
  settings: PlayerSettings;
  onSettingsChange: (settings: PlayerSettings) => void;
}

function ExpandedPlayerView({ player, settings, onSettingsChange }: ExpandedPlayerViewProps) {
  const { games, minutes, improvement } = settings;

  // Helper to update a single setting
  const updateSetting = (key: keyof PlayerSettings, value: number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // Calculate projected value with current slider values
  const projected = calculateSalary(games, minutes, player.darko, improvement);
  const projValNum = projected === "Minimum Salary" ? 0 : parseFloat(projected);

  let currentSurplus = 0;
  if (player.actualSalary) {
    currentSurplus = projValNum - player.actualSalary;
  }

  let runningTotalSurplus = currentSurplus;

  // Calculate multi-year projections
  const yearRows = FUTURE_YEARS.map((seasonLabel, idx) => {
    const yearOffset = idx + 1;
    const projectedAge = player.age + yearOffset;

    let cumulativeDelta = 0;
    for (let i = 0; i < yearOffset; i++) {
      cumulativeDelta += getAgingDelta(player.age + i);
    }

    const currentProjectedDarko = player.darko + improvement + cumulativeDelta;
    const rawMarketValue = calculateSalary(games, minutes, currentProjectedDarko, 0);

    let inflatedValueNum = 0;
    let projectedMarketValueLabel: string;

    if (rawMarketValue === "Minimum Salary") {
      projectedMarketValueLabel = "MIN";
      inflatedValueNum = 0;
    } else {
      inflatedValueNum = parseFloat(rawMarketValue) * (INFLATION_SCALERS[seasonLabel] || 1);
      projectedMarketValueLabel = `$${inflatedValueNum.toFixed(1)}M`;
    }

    const actualFutureSal = player.futureSalaries?.[seasonLabel];
    const yearlySurplus = actualFutureSal ? inflatedValueNum - actualFutureSal : 0;
    if (actualFutureSal) runningTotalSurplus += yearlySurplus;

    return {
      seasonLabel,
      projectedAge,
      projectedMarketValueLabel,
      actualFutureSal,
      yearlySurplus,
    };
  });

  return (
    <div class="expanded-player-view">
      <div class="expanded-player-meta">
        {player.team} · Age {player.age}
      </div>

      {/* Sliders */}
      <div class="slider-group">
        <div class="slider-label">
          <span>Games Played</span>
          <span class="slider-value">{games}</span>
        </div>
        <input
          type="range"
          min="1"
          max="82"
          value={games}
          onInput={(e) => updateSetting("games", parseInt((e.target as HTMLInputElement).value))}
          class="slider"
        />
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>Minutes Per Game</span>
          <span class="slider-value">{minutes}</span>
        </div>
        <input
          type="range"
          min="0"
          max="48"
          value={minutes}
          onInput={(e) => updateSetting("minutes", parseInt((e.target as HTMLInputElement).value))}
          class="slider"
        />
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>DARKO Adjustment</span>
          <span class="slider-value">
            {improvement > 0 ? "+" : ""}{improvement.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="-5"
          max="5"
          step="0.1"
          value={improvement}
          onInput={(e) => updateSetting("improvement", parseFloat((e.target as HTMLInputElement).value))}
          class="slider"
        />
        <div class="darko-info">
          <div class="darko-row">
            <span class="darko-label">Actual DARKO</span>
            <span class="darko-value" style={{ color: "var(--text-primary)" }}>
              {player.darko.toFixed(1)}
              <span class="darko-tier">({getDarkoLabel(player.darko)})</span>
            </span>
          </div>
          <div class="darko-row">
            <span class="darko-label">Adjusted DARKO</span>
            <span class="darko-value" style={{ color: "#60a5fa" }}>
              {(player.darko + improvement).toFixed(1)}
              <span class="darko-tier">({getDarkoLabel(player.darko + improvement)})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div class="results-panel">
        <div class="results-main">
          <div class="result-block">
            <div class="result-label">Projected Value '25-26</div>
            <div class="result-value result-value-projected">
              {projected === "Minimum Salary" ? "MIN" : `$${projected}M`}
            </div>
          </div>

          <div class="result-block">
            <div class="result-label">Actual Salary '25-26</div>
            <div class="result-value result-value-actual">
              {player.actualSalary && player.actualSalary > 0 ? (
                `$${player.actualSalary.toFixed(1)}M`
              ) : (
                <span class="free-agent-badge">FREE AGENT</span>
              )}
            </div>
            {player.actualSalary && (
              <div class={`result-surplus ${currentSurplus > 0 ? "surplus-positive" : "surplus-negative"}`}>
                {currentSurplus > 0 ? "+" : ""}{currentSurplus.toFixed(1)}M surplus
              </div>
            )}
          </div>
        </div>

        {/* Multi-year projections */}
        <div class="projections-section">
          <h3 class="projections-title">MULTI-YEAR PROJECTIONS</h3>
          <div class="projections-header">
            <span>Season</span>
            <span>Projected</span>
            <span>Actual</span>
            <span>Surplus</span>
          </div>
          <div>
            {yearRows.map((row) => (
              <div key={row.seasonLabel} class="projection-row">
                <span class="projection-season">
                  {row.seasonLabel}
                  <span class="projection-age">({row.projectedAge})</span>
                </span>
                <span class="projection-value">{row.projectedMarketValueLabel}</span>
                <span class="projection-actual">
                  {row.actualFutureSal ? `$${Number(row.actualFutureSal).toFixed(1)}M` : "FA"}
                </span>
                <span class={`projection-surplus ${row.yearlySurplus > 0 ? "surplus-positive" : "surplus-negative"}`}>
                  {row.actualFutureSal && (
                    <>
                      {row.yearlySurplus > 0 ? "+" : ""}{row.yearlySurplus.toFixed(1)}M
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div class="total-surplus">
            <span class="total-surplus-label">Total Contract Surplus</span>
            <span class={`total-surplus-value ${runningTotalSurplus > 0 ? "surplus-positive" : "surplus-negative"}`}>
              {runningTotalSurplus > 0 ? "+" : ""}{runningTotalSurplus.toFixed(1)}M
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
