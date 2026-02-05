import AppTabs from "../islands/AppTabs.tsx";
import { getPlayers } from "../lib/players-data.ts";

// Featured players for the empty state (diverse examples showing different valuations)
const FEATURED_PLAYER_NAMES = [
  "Nikola Jokic", // MVP-caliber, high surplus
  "Shai Gilgeous-Alexander", // Elite player, great value
  "Victor Wembanyama", // Young star on rookie deal
  "Chet Holmgren", // Young star, excellent surplus
  "LeBron James", // Veteran max contract
  "Stephen Curry", // Aging star, interesting valuation
];

// Featured teams for the empty state (diverse examples with positive and negative surplus)
const FEATURED_TEAM_CODES = [
  "OKC", // Oklahoma City Thunder - Well-run, young core (positive)
  "SAS", // San Antonio Spurs - Rebuilding with Wemby (positive)
  "HOU", // Houston Rockets - Young team developing (positive)
  "GSW", // Golden State Warriors - Aging stars, big contracts (negative)
  "SAC", // Sacramento Kings - Overpaying veterans (negative)
  "LAL", // Los Angeles Lakers - Veteran heavy (negative)
];

/**
 * Format a date string (YYYY-MM-DD) to a readable format like "Feb 5, 2026"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00"); // Add time to avoid timezone issues
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Home page component (async server component)
 *
 * Fresh 2.x supports async components that fetch data server-side.
 * This runs on the server and the result is sent as HTML to the client.
 */
export default async function Home() {
  // Fetch players from KV (falls back to hardcoded data if KV is empty)
  const { players, metadata } = await getPlayers();

  // Get featured players from the player data
  const featuredPlayers = players.filter((p) =>
    FEATURED_PLAYER_NAMES.includes(p.name)
  );

  return (
    <div class="app-container">
      {/* Header */}
      <header class="app-header">
        <h1 class="app-title">NBA SALARY VALUATION</h1>
        <p class="app-meta">
          Salary model by{" "}
          <a
            href="https://bsky.app/profile/stephnoh.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link"
          >
            Steph Noh
          </a>
          {" · "}Based on{" "}
          <a
            href="https://apanalytics.shinyapps.io/DARKO/"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link"
          >
            DARKO
          </a>
          {" · "}
          <a
            href="https://github.com/StephenNoh/nbasalarymodel/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link"
          >
            Methodology
          </a>
        </p>
        <p class="app-meta app-dates">
          {metadata.darkoUpdated && (
            <>
              DARKO updated{" "}
              <strong>{formatDate(metadata.darkoUpdated)}</strong>
            </>
          )}
          {metadata.darkoUpdated && metadata.playerStatsUpdated && (
            <span class="date-separator" />
          )}
          {metadata.playerStatsUpdated && (
            <>
              Player data updated{" "}
              <strong>{formatDate(metadata.playerStatsUpdated)}</strong>
            </>
          )}
          {(metadata.darkoUpdated || metadata.playerStatsUpdated) &&
            metadata.salaryModelUpdated && <span class="date-separator" />}
          {metadata.salaryModelUpdated && (
            <>
              Salary model updated{" "}
              <strong>{formatDate(metadata.salaryModelUpdated)}</strong>
            </>
          )}
          {/* Fallback to old format if no specific dates are set */}
          {!metadata.darkoUpdated &&
            !metadata.playerStatsUpdated &&
            !metadata.salaryModelUpdated && <>Updated {metadata.lastUpdated}</>}
        </p>
      </header>

      {/* Interactive App with Tab Navigation */}
      <AppTabs
        players={players}
        featuredPlayers={featuredPlayers}
        featuredTeamCodes={FEATURED_TEAM_CODES}
      />
    </div>
  );
}
