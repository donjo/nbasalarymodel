/**
 * TeamsComparison Island - Compare NBA team rosters and payrolls
 */

import { useState } from "preact/hooks";
import { SearchIcon, PlusIcon, TrashIcon } from "../components/Icons.tsx";
import type { Player } from "../lib/players.ts";
import { TEAM_NAMES, getTeamFullName, getUniqueTeamCodes } from "../lib/teams.ts";
import {
  calculateSalary,
  getDarkoLabel,
  getAgingDelta,
  INFLATION_SCALERS,
  FUTURE_YEARS,
} from "../lib/salary.ts";

interface Props {
  players: Player[];
}

// Standard defaults for team comparison (same as player calculator defaults)
const DEFAULT_GAMES = 70;
const DEFAULT_MINUTES = 30;

// Player settings for custom games/minutes/improvement
interface PlayerSettings {
  games: number;
  minutes: number;
  improvement: number;
}

// Format salary as currency (e.g., "$25.5M")
function formatSalary(salary: number): string {
  return `$${salary.toFixed(1)}M`;
}

// Calculate a player's projected contract value using the salary model
function getProjectedValue(player: Player, settings?: PlayerSettings): number {
  const games = settings?.games ?? DEFAULT_GAMES;
  const minutes = settings?.minutes ?? DEFAULT_MINUTES;
  const improvement = settings?.improvement ?? 0;

  const result = calculateSalary(games, minutes, player.darko, improvement);
  // "Minimum Salary" returns as a string, treat as ~2M for calculation purposes
  if (result === "Minimum Salary") return 2.0;
  return parseFloat(result);
}

export default function TeamsComparison({ players }: Props) {
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected teams to compare (stored as team codes)
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Get all unique team codes sorted alphabetically by full name
  const allTeamCodes = getUniqueTeamCodes();

  // Filter teams based on search term
  const getFilteredTeams = (term: string): string[] => {
    if (!term) return [];

    const lowerTerm = term.toLowerCase();

    // Filter teams that match the search and aren't already selected
    return allTeamCodes
      .filter((code) => {
        // Check if already selected
        if (selectedTeams.includes(code)) return false;

        // Match against full name or code
        const fullName = getTeamFullName(code).toLowerCase();
        return fullName.includes(lowerTerm) || code.toLowerCase().includes(lowerTerm);
      })
      .slice(0, 10);
  };

  // Add a team to the comparison
  const addTeam = (teamCode: string) => {
    setSelectedTeams([...selectedTeams, teamCode]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  // Remove a team from the comparison
  const removeTeam = (teamCode: string) => {
    setSelectedTeams(selectedTeams.filter((code) => code !== teamCode));
  };

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

  const filteredTeams = getFilteredTeams(searchTerm);

  return (
    <>
      {/* Global Search Box */}
      <div class="search-section">
        <div class="search-container">
          <label class="search-label">Search Teams</label>
          <div class="search-input-wrapper">
            <input
              type="text"
              value={searchTerm}
              onInput={(e) => {
                setSearchTerm((e.target as HTMLInputElement).value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search for a team to add..."
              class="search-input"
            />
            <div class="search-icon">
              <SearchIcon size={18} />
            </div>
          </div>

          {showDropdown && searchTerm && (
            <div class="dropdown">
              {filteredTeams.map((teamCode) => (
                <div key={teamCode} class="dropdown-item-with-button">
                  <div class="dropdown-item-info">
                    <div class="dropdown-item-name">{getTeamFullName(teamCode)}</div>
                    <div class="dropdown-item-stat">{teamCode}</div>
                  </div>
                  <button
                    onClick={() => addTeam(teamCode)}
                    class="dropdown-add-btn"
                  >
                    <PlusIcon size={16} />
                    Add
                  </button>
                </div>
              ))}
              {filteredTeams.length === 0 && (
                <div class="dropdown-empty">
                  {selectedTeams.some((code) =>
                    getTeamFullName(code).toLowerCase().includes(searchTerm.toLowerCase())
                  )
                    ? "Team already added"
                    : "No teams found"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Team Cards Grid */}
      {selectedTeams.length > 0 && (
        <div class="player-grid">
          {selectedTeams.map((teamCode) => (
            <TeamCard
              key={teamCode}
              teamCode={teamCode}
              roster={getTeamRoster(teamCode)}
              totalPayroll={getTeamPayroll(teamCode)}
              onRemove={() => removeTeam(teamCode)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {selectedTeams.length === 0 && (
        <div class="empty-state">
          <p>Search for teams above to compare rosters and payrolls</p>
        </div>
      )}
    </>
  );
}

// Sort options for the roster table
type SortField = "salary" | "value" | "surplus";

interface TeamCardProps {
  teamCode: string;
  roster: Player[];
  totalPayroll: number;
  onRemove: () => void;
}

function TeamCard({ teamCode, roster, totalPayroll, onRemove }: TeamCardProps) {
  // Sort state - default to salary (highest first)
  const [sortBy, setSortBy] = useState<SortField>("salary");

  // Track which player is expanded (null = none)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Track custom settings per player (keyed by player name)
  const [playerSettings, setPlayerSettings] = useState<Record<string, PlayerSettings>>({});

  // Get settings for a player (returns defaults if not customized)
  const getSettings = (playerName: string): PlayerSettings => {
    return playerSettings[playerName] || {
      games: DEFAULT_GAMES,
      minutes: DEFAULT_MINUTES,
      improvement: 0,
    };
  };

  // Update settings for a player
  const updateSettings = (playerName: string, newSettings: PlayerSettings) => {
    setPlayerSettings((prev) => ({
      ...prev,
      [playerName]: newSettings,
    }));
  };

  // Calculate total projected value and surplus for the team (using custom settings)
  const totalValue = roster.reduce(
    (sum, player) => sum + getProjectedValue(player, getSettings(player.name)),
    0
  );
  const totalSurplus = totalValue - totalPayroll;

  // Sort the roster based on current sort field (using custom settings)
  const sortedRoster = [...roster].sort((a, b) => {
    const aValue = getProjectedValue(a, getSettings(a.name));
    const bValue = getProjectedValue(b, getSettings(b.name));
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
            const settings = getSettings(player.name);
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
                    <span class={`roster-player-settings ${settings.games !== DEFAULT_GAMES || settings.minutes !== DEFAULT_MINUTES ? "roster-player-settings-modified" : ""}`}>
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
