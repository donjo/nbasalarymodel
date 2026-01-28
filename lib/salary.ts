/**
 * Salary calculation utilities for the NBA Salary Model
 */

/**
 * Converts a DARKO rating to a human-readable player tier label
 */
export function getDarkoLabel(darko: number): string {
  if (darko >= 6.0) return "MVP Level";
  if (darko >= 4.0) return "All-NBA";
  if (darko >= 2.0) return "All-Star";
  if (darko >= 1.0) return "Quality Starter";
  if (darko >= -0.9) return "Average Player";
  if (darko >= -2.0) return "Bench";
  return "Replacement Level";
}

/**
 * Calculates a player's projected salary based on games, minutes, and DARKO rating
 * Returns either a dollar amount in millions or "Minimum Salary" for low values
 */
export function calculateSalary(
  games: number,
  minutes: number,
  darko: number,
  adjustment: number
): string {
  const adjustedDarko = darko + adjustment;
  let salary = ((games * minutes) / 1475) * (adjustedDarko + 3.0) * 4.32;

  // Apply a boost/penalty based on how far from average the player is
  const boostFactor = Math.pow(Math.abs(adjustedDarko) / 4, 1.2) * 0.1;
  const cappedBoost = Math.min(boostFactor, 0.1);

  if (adjustedDarko > 0) {
    salary = salary * (1 + cappedBoost);
  } else if (adjustedDarko < 0) {
    salary = salary * (1 - cappedBoost);
  }

  if (salary < 3.0) return "Minimum Salary";
  return salary.toFixed(1);
}

/**
 * Returns the DARKO change per year based on a player's age (aging curve)
 */
export function getAgingDelta(age: number): number {
  if (age < 21) return 0.65;
  if (age < 22) return 0.5;
  if (age < 23) return 0.45;
  if (age < 24) return 0.4;
  if (age < 27) return 0.1;
  if (age < 29) return 0;
  if (age < 30) return -0.05;
  if (age < 31) return -0.1;
  if (age < 32) return -0.2;
  if (age < 33) return -0.3;
  if (age < 34) return -0.45;
  if (age < 35) return -0.65;
  if (age < 36) return -0.9;
  return -1.2;
}

/**
 * Salary cap inflation multipliers for future seasons
 */
export const INFLATION_SCALERS: Record<string, number> = {
  "2026-27": 1.074,
  "2027-28": 1.127,
  "2028-29": 1.184,
  "2029-30": 1.24,
  "2030-31": 1.305,
};

/**
 * Future season labels for multi-year projections
 */
export const FUTURE_YEARS = [
  "2026-27",
  "2027-28",
  "2028-29",
  "2029-30",
  "2030-31",
];
