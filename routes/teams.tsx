import TeamsComparison from "../islands/TeamsComparison.tsx";
import { PLAYER_DATA } from "../lib/players.ts";

export default function Teams() {
  return (
    <div class="app-container">
      {/* Header */}
      <header class="app-header">
        <h1 class="app-title">TEAM COMPARISON</h1>
        <p class="app-subtitle">
          Compare NBA team rosters and total payrolls side-by-side.
        </p>
        <p class="app-meta">
          <a href="/" class="app-link">
            &larr; Back to Player Salary Model
          </a>
        </p>
      </header>

      {/* Interactive Teams Comparison */}
      <TeamsComparison players={PLAYER_DATA} />
    </div>
  );
}
