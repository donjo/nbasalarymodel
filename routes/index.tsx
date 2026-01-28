import SalaryCalculator from "../islands/SalaryCalculator.tsx";
import { PLAYER_DATA } from "../lib/players.ts";

export default function Home() {
  return (
    <div class="app-container">
      {/* Header */}
      <header class="app-header">
        <h1 class="app-title">NBA SALARY MODEL</h1>
        <p class="app-subtitle">
          Calculate contract value based on{" "}
          <a
            href="https://apanalytics.shinyapps.io/DARKO/"
            target="_blank"
            rel="noopener noreferrer"
            class="app-link"
          >
            DARKO
          </a>{" "}
          and custom minutes projection.
        </p>
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
          {" · "}DARKO updated 1/21/26{" · "}
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

      {/* Interactive Calculator */}
      <SalaryCalculator players={PLAYER_DATA} />
    </div>
  );
}
