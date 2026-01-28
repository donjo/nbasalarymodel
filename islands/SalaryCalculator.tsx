/**
 * SalaryCalculator Island - Sports Analytics Editorial Design
 */

import { useState } from "preact/hooks";
import { SearchIcon, PlusIcon, TrashIcon } from "../components/Icons.tsx";
import type { Player } from "../lib/players.ts";
import {
  getDarkoLabel,
  calculateSalary,
  getAgingDelta,
  INFLATION_SCALERS,
  FUTURE_YEARS,
} from "../lib/salary.ts";

interface Comparison {
  id: number;
  selectedPlayer: Player | null;
  games: number;
  minutes: number;
  improvement: number;
  searchTerm: string;
  showDropdown: boolean;
}

interface Props {
  players: Player[];
}

export default function SalaryCalculator({ players }: Props) {
  const [comparisons, setComparisons] = useState<Comparison[]>([
    {
      id: 1,
      selectedPlayer: null,
      games: 70,
      minutes: 30,
      improvement: 0,
      searchTerm: "",
      showDropdown: false,
    },
  ]);

  const addComparison = () => {
    setComparisons([
      ...comparisons,
      {
        id: Date.now(),
        selectedPlayer: null,
        games: 70,
        minutes: 30,
        improvement: 0,
        searchTerm: "",
        showDropdown: false,
      },
    ]);
  };

  const removeComparison = (id: number) => {
    if (comparisons.length > 1) {
      setComparisons(comparisons.filter((c) => c.id !== id));
    }
  };

  const updateComparison = (
    id: number,
    field: keyof Comparison,
    value: unknown
  ) => {
    setComparisons(
      comparisons.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const updateMultipleFields = (
    id: number,
    updates: Partial<Comparison>
  ) => {
    setComparisons(
      comparisons.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const selectPlayer = (id: number, player: Player) => {
    setComparisons(
      comparisons.map((c) =>
        c.id === id
          ? {
              ...c,
              selectedPlayer: player,
              searchTerm: player.name,
              showDropdown: false,
            }
          : c
      )
    );
  };

  const getFilteredPlayers = (searchTerm: string): Player[] => {
    if (!searchTerm) return [];
    return players
      .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
  };

  return (
    <>
      <div class="player-grid">
        {comparisons.map((comp, index) => (
          <PlayerCard
            key={comp.id}
            comp={comp}
            index={index}
            showRemove={comparisons.length > 1}
            onRemove={() => removeComparison(comp.id)}
            onUpdate={(field, value) => updateComparison(comp.id, field, value)}
            onUpdateMultiple={(updates) => updateMultipleFields(comp.id, updates)}
            onSelectPlayer={(player) => selectPlayer(comp.id, player)}
            getFilteredPlayers={getFilteredPlayers}
          />
        ))}
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <button onClick={addComparison} class="add-player-btn">
          <PlusIcon size={20} />
          ADD PLAYER
        </button>
      </div>
    </>
  );
}

interface PlayerCardProps {
  comp: Comparison;
  index: number;
  showRemove: boolean;
  onRemove: () => void;
  onUpdate: (field: keyof Comparison, value: unknown) => void;
  onUpdateMultiple: (updates: Partial<Comparison>) => void;
  onSelectPlayer: (player: Player) => void;
  getFilteredPlayers: (searchTerm: string) => Player[];
}

function PlayerCard({
  comp,
  index,
  showRemove,
  onRemove,
  onUpdate,
  onUpdateMultiple,
  onSelectPlayer,
  getFilteredPlayers,
}: PlayerCardProps) {
  return (
    <div class="player-card">
      <div class="player-card-header">
        <h2 class="player-card-title">PLAYER {index + 1}</h2>
        {showRemove && (
          <button onClick={onRemove} class="remove-btn">
            <TrashIcon size={16} />
          </button>
        )}
      </div>

      <div class="search-container">
        <label class="search-label">Player Name</label>
        <div class="search-input-wrapper">
          <input
            type="text"
            value={comp.searchTerm}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              onUpdateMultiple({
                searchTerm: target.value,
                showDropdown: true,
                selectedPlayer: null,
              });
            }}
            onFocus={() => onUpdate("showDropdown", true)}
            placeholder="Search for a player..."
            class="search-input"
          />
          <div class="search-icon">
            <SearchIcon size={18} />
          </div>
        </div>

        {comp.showDropdown && comp.searchTerm && !comp.selectedPlayer && (
          <div class="dropdown">
            {getFilteredPlayers(comp.searchTerm).map((player) => (
              <button
                key={player.name}
                onClick={() => onSelectPlayer(player)}
                class="dropdown-item"
              >
                <div class="dropdown-item-name">{player.name}</div>
                <div class="dropdown-item-stat">
                  DARKO: {player.darko.toFixed(2)} · {player.team}
                </div>
              </button>
            ))}
            {getFilteredPlayers(comp.searchTerm).length === 0 && (
              <div class="dropdown-empty">No players found</div>
            )}
          </div>
        )}
      </div>

      {comp.selectedPlayer && (
        <PlayerDetails comp={comp} onUpdate={onUpdate} />
      )}
    </div>
  );
}

interface PlayerDetailsProps {
  comp: Comparison;
  onUpdate: (field: keyof Comparison, value: unknown) => void;
}

function PlayerDetails({ comp, onUpdate }: PlayerDetailsProps) {
  const player = comp.selectedPlayer!;

  return (
    <>
      <div class="slider-group">
        <div class="slider-label">
          <span>Games Played</span>
          <span class="slider-value">{comp.games}</span>
        </div>
        <input
          type="range"
          min="1"
          max="82"
          value={comp.games}
          onInput={(e) =>
            onUpdate("games", parseInt((e.target as HTMLInputElement).value))
          }
          class="slider"
        />
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>Minutes Per Game</span>
          <span class="slider-value">{comp.minutes}</span>
        </div>
        <input
          type="range"
          min="0"
          max="48"
          value={comp.minutes}
          onInput={(e) =>
            onUpdate("minutes", parseInt((e.target as HTMLInputElement).value))
          }
          class="slider"
        />
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>DARKO Adjustment</span>
          <span class="slider-value">
            {comp.improvement > 0 ? "+" : ""}
            {comp.improvement.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="-5"
          max="5"
          step="0.1"
          value={comp.improvement}
          onInput={(e) =>
            onUpdate(
              "improvement",
              parseFloat((e.target as HTMLInputElement).value)
            )
          }
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
              {(player.darko + comp.improvement).toFixed(1)}
              <span class="darko-tier">
                ({getDarkoLabel(player.darko + comp.improvement)})
              </span>
            </span>
          </div>
        </div>
      </div>

      <ResultsPanel comp={comp} />
    </>
  );
}

interface ResultsPanelProps {
  comp: Comparison;
}

function ResultsPanel({ comp }: ResultsPanelProps) {
  const player = comp.selectedPlayer!;
  const projected = calculateSalary(
    comp.games,
    comp.minutes,
    player.darko,
    comp.improvement
  );
  const projValNum = projected === "Minimum Salary" ? 0 : parseFloat(projected);

  let currentSurplus = 0;
  if (player.actualSalary) {
    currentSurplus = projValNum - player.actualSalary;
  }

  let runningTotalSurplus = currentSurplus;

  const yearRows = FUTURE_YEARS.map((seasonLabel, idx) => {
    const yearOffset = idx + 1;
    const projectedAge = player.age + yearOffset;

    let cumulativeDelta = 0;
    for (let i = 0; i < yearOffset; i++) {
      cumulativeDelta += getAgingDelta(player.age + i);
    }

    const currentProjectedDarko =
      player.darko + comp.improvement + cumulativeDelta;
    const rawMarketValue = calculateSalary(
      comp.games,
      comp.minutes,
      currentProjectedDarko,
      0
    );

    let inflatedValueNum = 0;
    let projectedMarketValueLabel: string;

    if (rawMarketValue === "Minimum Salary") {
      projectedMarketValueLabel = "MIN";
      inflatedValueNum = 0;
    } else {
      inflatedValueNum =
        parseFloat(rawMarketValue) * (INFLATION_SCALERS[seasonLabel] || 1);
      projectedMarketValueLabel = `$${inflatedValueNum.toFixed(1)}M`;
    }

    const actualFutureSal = player.futureSalaries?.[seasonLabel];
    const yearlySurplus = actualFutureSal
      ? inflatedValueNum - actualFutureSal
      : 0;
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
    <div class="results-panel">
      <div class="results-player-name">{player.name}</div>

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
            <div
              class={`result-surplus ${
                currentSurplus > 0 ? "surplus-positive" : "surplus-negative"
              }`}
            >
              {currentSurplus > 0 ? "+" : ""}
              {currentSurplus.toFixed(1)}M surplus
            </div>
          )}
        </div>
      </div>

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
              <span class="projection-value">
                {row.projectedMarketValueLabel}
              </span>
              <span class="projection-actual">
                {row.actualFutureSal
                  ? `$${Number(row.actualFutureSal).toFixed(1)}M`
                  : "FA"}
              </span>
              <span
                class={`projection-surplus ${
                  row.yearlySurplus > 0 ? "surplus-positive" : "surplus-negative"
                }`}
              >
                {row.actualFutureSal && (
                  <>
                    {row.yearlySurplus > 0 ? "+" : ""}
                    {row.yearlySurplus.toFixed(1)}M
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        <div class="total-surplus">
          <span class="total-surplus-label">Total Contract Surplus</span>
          <span
            class={`total-surplus-value ${
              runningTotalSurplus > 0 ? "surplus-positive" : "surplus-negative"
            }`}
          >
            {runningTotalSurplus > 0 ? "+" : ""}
            {runningTotalSurplus.toFixed(1)}M
          </span>
        </div>
      </div>
    </div>
  );
}
