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

interface PlayerCard {
  id: number;
  player: Player;
  games: number;
  minutes: number;
  improvement: number;
}

interface Props {
  players: Player[];
}

export default function SalaryCalculator({ players }: Props) {
  // Global search state
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Player cards (only for added players)
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);

  const getFilteredPlayers = (term: string): Player[] => {
    if (!term) return [];
    // Filter out players that are already added
    const addedNames = new Set(playerCards.map((c) => c.player.name));
    return players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term.toLowerCase()) &&
          !addedNames.has(p.name)
      )
      .slice(0, 10);
  };

  const addPlayer = (player: Player) => {
    setPlayerCards([
      ...playerCards,
      {
        id: Date.now(),
        player,
        games: 70,
        minutes: 30,
        improvement: 0,
      },
    ]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removePlayer = (id: number) => {
    setPlayerCards(playerCards.filter((c) => c.id !== id));
  };

  const updatePlayerCard = (
    id: number,
    field: keyof Omit<PlayerCard, "id" | "player">,
    value: number
  ) => {
    setPlayerCards(
      playerCards.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const filteredPlayers = getFilteredPlayers(searchTerm);

  return (
    <>
      {/* Global Search Box */}
      <div class="search-section">
        <div class="search-container">
          <label class="search-label">Search Players</label>
          <div class="search-input-wrapper">
            <input
              type="text"
              value={searchTerm}
              onInput={(e) => {
                setSearchTerm((e.target as HTMLInputElement).value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search for a player to add..."
              class="search-input"
            />
            <div class="search-icon">
              <SearchIcon size={18} />
            </div>
          </div>

          {showDropdown && searchTerm && (
            <div class="dropdown">
              {filteredPlayers.map((player) => (
                <div key={player.name} class="dropdown-item-with-button">
                  <div class="dropdown-item-info">
                    <div class="dropdown-item-name">{player.name}</div>
                    <div class="dropdown-item-stat">
                      DARKO: {player.darko.toFixed(2)} · {player.team}
                    </div>
                  </div>
                  <button
                    onClick={() => addPlayer(player)}
                    class="dropdown-add-btn"
                  >
                    <PlusIcon size={16} />
                    Add
                  </button>
                </div>
              ))}
              {filteredPlayers.length === 0 && (
                <div class="dropdown-empty">
                  {playerCards.some((c) =>
                    c.player.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                    ? "Player already added"
                    : "No players found"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Player Cards */}
      {playerCards.length > 0 && (
        <div class="player-grid">
          {playerCards.map((card) => (
            <PlayerCardComponent
              key={card.id}
              card={card}
              onRemove={() => removePlayer(card.id)}
              onUpdate={(field, value) => updatePlayerCard(card.id, field, value)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {playerCards.length === 0 && (
        <div class="empty-state">
          <p>Search for players above to start comparing salaries</p>
        </div>
      )}
    </>
  );
}

interface PlayerCardComponentProps {
  card: PlayerCard;
  onRemove: () => void;
  onUpdate: (field: keyof Omit<PlayerCard, "id" | "player">, value: number) => void;
}

function PlayerCardComponent({
  card,
  onRemove,
  onUpdate,
}: PlayerCardComponentProps) {
  const player = card.player;

  return (
    <div class="player-card">
      <div class="player-card-header">
        <h2 class="player-card-title">{player.name}</h2>
        <button onClick={onRemove} class="remove-btn">
          <TrashIcon size={16} />
        </button>
      </div>

      <div class="player-card-meta">
        {player.team} · Age {player.age}
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>Games Played</span>
          <span class="slider-value">{card.games}</span>
        </div>
        <input
          type="range"
          min="1"
          max="82"
          value={card.games}
          onInput={(e) =>
            onUpdate("games", parseInt((e.target as HTMLInputElement).value))
          }
          class="slider"
        />
      </div>

      <div class="slider-group">
        <div class="slider-label">
          <span>Minutes Per Game</span>
          <span class="slider-value">{card.minutes}</span>
        </div>
        <input
          type="range"
          min="0"
          max="48"
          value={card.minutes}
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
            {card.improvement > 0 ? "+" : ""}
            {card.improvement.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="-5"
          max="5"
          step="0.1"
          value={card.improvement}
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
              {(player.darko + card.improvement).toFixed(1)}
              <span class="darko-tier">
                ({getDarkoLabel(player.darko + card.improvement)})
              </span>
            </span>
          </div>
        </div>
      </div>

      <ResultsPanel card={card} />
    </div>
  );
}

interface ResultsPanelProps {
  card: PlayerCard;
}

function ResultsPanel({ card }: ResultsPanelProps) {
  const player = card.player;
  const projected = calculateSalary(
    card.games,
    card.minutes,
    player.darko,
    card.improvement
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
      player.darko + card.improvement + cumulativeDelta;
    const rawMarketValue = calculateSalary(
      card.games,
      card.minutes,
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
