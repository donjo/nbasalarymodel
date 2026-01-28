import AppTabs from "../islands/AppTabs.tsx";
import { PLAYER_DATA } from "../lib/players.ts";

// Featured players for the empty state (diverse examples showing different valuations)
const FEATURED_PLAYER_NAMES = [
  "Nikola Jokic",         // MVP-caliber, high surplus
  "Shai Gilgeous-Alexander", // Elite player, great value
  "Victor Wembanyama",    // Young star on rookie deal
  "Chet Holmgren",        // Young star, excellent surplus
  "LeBron James",         // Veteran max contract
  "Stephen Curry",        // Aging star, interesting valuation
];

// Featured teams for the empty state (diverse examples with positive and negative surplus)
const FEATURED_TEAM_CODES = [
  "OKC",  // Oklahoma City Thunder - Well-run, young core (positive)
  "SAS",  // San Antonio Spurs - Rebuilding with Wemby (positive)
  "HOU",  // Houston Rockets - Young team developing (positive)
  "GSW",  // Golden State Warriors - Aging stars, big contracts (negative)
  "LAL",  // Los Angeles Lakers - Veteran heavy (negative)
  "MIL",  // Milwaukee Bucks - Mixed roster (negative)
];

// Get featured players from the player data
const featuredPlayers = PLAYER_DATA.filter((p) =>
  FEATURED_PLAYER_NAMES.includes(p.name)
);

export default function Home() {
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
          {" · "}Updated 1/21/26{" · "}
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
        players={PLAYER_DATA}
        featuredPlayers={featuredPlayers}
        featuredTeamCodes={FEATURED_TEAM_CODES}
      />
    </div>
  );
}
