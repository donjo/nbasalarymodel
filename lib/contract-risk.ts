import type { Player } from "./types.ts";
import type { DarkoHistoryPoint } from "./darko-history.ts";

export interface ContractRiskSummary {
  score: number;
  label: "Low" | "Medium" | "High";
  reason: string;
}

export interface DarkoTrendSummary {
  latestDarko: number;
  previousDarko: number;
  change: number;
  direction: "up" | "down" | "flat";
  latestDate: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getDarkoTrendSummary(
  history: DarkoHistoryPoint[] = [],
  fallbackDarko: number,
): DarkoTrendSummary {
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const latestDarko = latest?.darko ?? fallbackDarko;
  const previousDarko = previous?.darko ?? latestDarko;
  const change = latestDarko - previousDarko;

  return {
    latestDarko,
    previousDarko,
    change,
    direction: change > 0.05 ? "up" : change < -0.05 ? "down" : "flat",
    latestDate: latest?.date ?? "Current",
  };
}

export function getContractRiskSummary(
  player: Player,
  projectedValue: number,
  history: DarkoHistoryPoint[] = [],
): ContractRiskSummary {
  const ageRisk = player.age >= 30 ? Math.min(30, (player.age - 29) * 6) : 0;

  const latest = history[history.length - 1]?.darko ?? player.darko;
  const earliest = history[0]?.darko ?? player.darko;
  const trendDelta = latest - earliest;
  const trendRisk = trendDelta < -0.2
    ? Math.min(30, Math.abs(trendDelta) * 25)
    : 0;

  const surplus = projectedValue - player.actualSalary;
  const surplusRisk = surplus < -2 ? 15 : surplus < 0 ? 8 : 0;

  const minutesRisk = (player.avgMinutes ?? 0) < 20 ? 8 : 0;
  const score = clamp(ageRisk + trendRisk + surplusRisk + minutesRisk, 0, 100);

  let label: ContractRiskSummary["label"] = "Low";
  if (score >= 60) label = "High";
  else if (score >= 30) label = "Medium";

  const reason = [
    player.age >= 30 ? "Older profile" : "Younger profile",
    trendDelta < -0.2 ? "DARKO trend is sliding" : "DARKO trend is stable",
    surplus < 0
      ? "Salary is above model value"
      : "Model value is above salary",
  ].join(" · ");

  return { score, label, reason };
}
