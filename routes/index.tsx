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
          {" · "}Updated {metadata.lastUpdated}{" · "}
          <a
            href="https://github.com/StephenNoh/nbasalarymodel/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link"
          >
            Methodology
          </a>
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
