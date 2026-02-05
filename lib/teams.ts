/**
 * Team name mapping for NBA teams
 * Maps 3-letter team codes to full team names
 */

// All 30 NBA teams with their codes and full names
export const TEAM_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  BRK: "Brooklyn Nets",
  CHI: "Chicago Bulls",
  CHO: "Charlotte Hornets",
  CHA: "Charlotte Hornets",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHO: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

// Helper function to get full team name from code
export function getTeamFullName(code: string): string {
  return TEAM_NAMES[code] || code;
}

// Maps NBA API team codes to our app's codes
// The NBA API uses different abbreviations for some teams
export const NBA_API_TO_APP_CODES: Record<string, string> = {
  PHX: "PHO", // Phoenix Suns
  CHA: "CHO", // Charlotte Hornets
};

// Normalize a team code from the NBA API to our app's code
export function normalizeTeamCode(apiCode: string): string {
  return NBA_API_TO_APP_CODES[apiCode] || apiCode;
}

// Get unique team codes (without duplicates like BKN/BRK)
export function getUniqueTeamCodes(): string[] {
  const uniqueNames = new Set<string>();
  const uniqueCodes: string[] = [];

  for (const [code, name] of Object.entries(TEAM_NAMES)) {
    if (!uniqueNames.has(name)) {
      uniqueNames.add(name);
      uniqueCodes.push(code);
    }
  }

  return uniqueCodes.sort((a, b) =>
    TEAM_NAMES[a].localeCompare(TEAM_NAMES[b])
  );
}
