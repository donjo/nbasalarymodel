/**
 * SalaryCalculator Island - Sports Analytics Editorial Design
 */

import { useState, useEffect } from "preact/hooks";
import { PlusIcon, TrashIcon } from "../components/Icons.tsx";
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
  featuredPlayers?: Player[];
  addedPlayerNames: Set<string>;
  onPlayerAdded: (name: string) => void;
  onPlayerRemoved: (name: string) => void;
}

// Default values for projections
const DEFAULT_GAMES = 70;
const DEFAULT_MINUTES = 30;

export default function SalaryCalculator({
  players,
  featuredPlayers = [],
  addedPlayerNames,
  onPlayerAdded,
  onPlayerRemoved,
}: Props) {
  // Player cards (only for added players)
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);

  // Sync playerCards with addedPlayerNames from parent
  useEffect(() => {
    // Add new players that aren't in cards yet
    addedPlayerNames.forEach((name) => {
      if (!playerCards.some((c) => c.player.name === name)) {
        const player = players.find((p) => p.name === name);
        if (player) {
          setPlayerCards((prev) => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              player,
              games: DEFAULT_GAMES,
              minutes: DEFAULT_MINUTES,
              improvement: 0,
            },
          ]);
        }
      }
    });

    // Remove players that are no longer in addedPlayerNames
    setPlayerCards((prev) =>
      prev.filter((c) => addedPlayerNames.has(c.player.name))
    );
  }, [addedPlayerNames, players]);

  const addPlayer = (player: Player) => {
    onPlayerAdded(player.name);
  };

  const removePlayer = (card: PlayerCard) => {
    onPlayerRemoved(card.player.name);
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

  // Filter out featured players that are already added
  const availableFeatured = featuredPlayers.filter(
    (p) => !addedPlayerNames.has(p.name)
  );

  // Check if we're in comparison mode (at least one player added)
  const isComparisonMode = playerCards.length > 0;

  return (
    <>
      {/* Player Cards (comparison mode) */}
      {isComparisonMode && (
        <div class="player-grid">
          {playerCards.map((card) => (
            <PlayerCardComponent
              key={card.id}
              card={card}
              onRemove={() => removePlayer(card)}
              onUpdate={(field, value) => updatePlayerCard(card.id, field, value)}
            />
          ))}
        </div>
      )}

      {/* Empty state with featured players */}
      {!isComparisonMode && (
        <div class="featured-section">
          <div class="featured-header">
            <h2 class="featured-title">Featured Players</h2>
            <p class="featured-subtitle">
              Click "Add" to start comparing player valuations
            </p>
          </div>
          <div class="preview-grid">
            {availableFeatured.map((player) => (
              <PlayerPreviewCard
                key={player.name}
                player={player}
                onAdd={() => addPlayer(player)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Preview card component - shows valuation stats without sliders
interface PlayerPreviewCardProps {
  player: Player;
  onAdd: () => void;
}

function PlayerPreviewCard({ player, onAdd }: PlayerPreviewCardProps) {
  // Calculate projected value with default settings
  const projected = calculateSalary(
    DEFAULT_GAMES,
    DEFAULT_MINUTES,
    player.darko,
    0 // no improvement adjustment
  );
  const projValNum = projected === "Minimum Salary" ? 0 : parseFloat(projected);

  // Calculate surplus
  const surplus = player.actualSalary > 0 ? projValNum - player.actualSalary : 0;

  return (
    <div class="preview-card">
      <button onClick={onAdd} class="preview-add-btn" title="Add to comparison">
        <PlusIcon size={14} />
        Add
      </button>

      <h3 class="preview-card-title">{player.name}</h3>
      <div class="preview-card-meta">
        {player.team} · Age {player.age}
      </div>

      <div class="preview-stats">
        <div class="preview-stat">
          <span class="preview-stat-label">Actual Salary</span>
          <span class="preview-stat-value">
            {player.actualSalary > 0 ? `$${player.actualSalary.toFixed(1)}M` : "FA"}
          </span>
        </div>
        <div class="preview-stat">
          <span class="preview-stat-label">Projected Value</span>
          <span class="preview-stat-value">
            {projected === "Minimum Salary" ? "MIN" : `$${projected}M`}
          </span>
        </div>
        {player.actualSalary > 0 && (
          <div class="preview-stat preview-stat-surplus">
            <span class="preview-stat-label">Surplus</span>
            <span
              class={`preview-stat-value ${
                surplus >= 0 ? "surplus-positive" : "surplus-negative"
              }`}
            >
              {surplus >= 0 ? "+" : ""}${surplus.toFixed(1)}M
            </span>
          </div>
        )}
      </div>
    </div>
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
        <div class="player-card-title-row">
          <h2 class="player-card-title">{player.name}</h2>
          <span class="player-card-meta-inline">{player.team} · {player.age}</span>
        </div>
        <button onClick={onRemove} class="remove-btn">
          <TrashIcon size={16} />
        </button>
      </div>

      <ResultsPanel card={card} />

      <div class="adjustments-section">
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
      </div>
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
