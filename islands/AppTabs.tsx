/**
 * AppTabs Island - Handles tab switching between Player and Team views
 * Includes unified search in the navigation bar
 */

import { useState } from "preact/hooks";
import { SearchIcon, PlusIcon } from "../components/Icons.tsx";
import SalaryCalculator from "./SalaryCalculator.tsx";
import TeamsComparison from "./TeamsComparison.tsx";
import type { Player } from "../lib/players.ts";
import { getTeamFullName, getUniqueTeamCodes } from "../lib/teams.ts";

interface Props {
  players: Player[];
  featuredPlayers: Player[];
  featuredTeamCodes: string[];
}

export default function AppTabs({
  players,
  featuredPlayers,
  featuredTeamCodes,
}: Props) {
  // Tab state - default to player view
  const [activeTab, setActiveTab] = useState<"player" | "team">("player");

  // Search state (unified for both tabs)
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Track added players and teams
  const [addedPlayerNames, setAddedPlayerNames] = useState<Set<string>>(new Set());
  const [addedTeamCodes, setAddedTeamCodes] = useState<Set<string>>(new Set());

  // Get all unique team codes
  const allTeamCodes = getUniqueTeamCodes();

  // Filter players based on search
  const getFilteredPlayers = (term: string): Player[] => {
    if (!term) return [];
    return players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term.toLowerCase()) &&
          !addedPlayerNames.has(p.name)
      )
      .slice(0, 10);
  };

  // Filter teams based on search
  const getFilteredTeams = (term: string): string[] => {
    if (!term) return [];
    const lowerTerm = term.toLowerCase();
    return allTeamCodes
      .filter((code) => {
        if (addedTeamCodes.has(code)) return false;
        const fullName = getTeamFullName(code).toLowerCase();
        return fullName.includes(lowerTerm) || code.toLowerCase().includes(lowerTerm);
      })
      .slice(0, 10);
  };

  const filteredPlayers = activeTab === "player" ? getFilteredPlayers(searchTerm) : [];
  const filteredTeams = activeTab === "team" ? getFilteredTeams(searchTerm) : [];

  // Callbacks to track added items (passed to child components)
  const handlePlayerAdded = (name: string) => {
    setAddedPlayerNames(new Set([...addedPlayerNames, name]));
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handlePlayerRemoved = (name: string) => {
    const newSet = new Set(addedPlayerNames);
    newSet.delete(name);
    setAddedPlayerNames(newSet);
  };

  const handleTeamAdded = (code: string) => {
    setAddedTeamCodes(new Set([...addedTeamCodes, code]));
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleTeamRemoved = (code: string) => {
    const newSet = new Set(addedTeamCodes);
    newSet.delete(code);
    setAddedTeamCodes(newSet);
  };

  // Handle adding from search dropdown
  const handleAddPlayer = (player: Player) => {
    handlePlayerAdded(player.name);
  };

  const handleAddTeam = (teamCode: string) => {
    handleTeamAdded(teamCode);
  };

  return (
    <>
      {/* Tab Navigation with Search */}
      <div class="tab-section">
        <div class="tab-nav-row">
          <div class="tab-navigation">
            <button
              class={`tab-button ${activeTab === "player" ? "tab-button-active" : ""}`}
              onClick={() => {
                setActiveTab("player");
                setSearchTerm("");
                setShowDropdown(false);
              }}
            >
              Player
            </button>
            <button
              class={`tab-button ${activeTab === "team" ? "tab-button-active" : ""}`}
              onClick={() => {
                setActiveTab("team");
                setSearchTerm("");
                setShowDropdown(false);
              }}
            >
              Team
            </button>
          </div>

          {/* Search Box */}
          <div class="nav-search-container">
            <div class="search-input-wrapper">
              <input
                type="text"
                value={searchTerm}
                onInput={(e) => {
                  setSearchTerm((e.target as HTMLInputElement).value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={activeTab === "player" ? "Search players..." : "Search teams..."}
                class="search-input"
              />
              <div class="search-icon">
                <SearchIcon size={18} />
              </div>
            </div>

            {showDropdown && searchTerm && (
              <div class="dropdown">
                {activeTab === "player" && (
                  <>
                    {filteredPlayers.map((player) => (
                      <div key={player.name} class="dropdown-item-with-button">
                        <div class="dropdown-item-info">
                          <div class="dropdown-item-name">{player.name}</div>
                          <div class="dropdown-item-stat">
                            DARKO: {player.darko.toFixed(2)} · {player.team}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddPlayer(player)}
                          class="dropdown-add-btn"
                        >
                          <PlusIcon size={16} />
                          Add
                        </button>
                      </div>
                    ))}
                    {filteredPlayers.length === 0 && (
                      <div class="dropdown-empty">
                        {addedPlayerNames.has(searchTerm) ? "Player already added" : "No players found"}
                      </div>
                    )}
                  </>
                )}
                {activeTab === "team" && (
                  <>
                    {filteredTeams.map((teamCode) => (
                      <div key={teamCode} class="dropdown-item-with-button">
                        <div class="dropdown-item-info">
                          <div class="dropdown-item-name">{getTeamFullName(teamCode)}</div>
                          <div class="dropdown-item-stat">{teamCode}</div>
                        </div>
                        <button
                          onClick={() => handleAddTeam(teamCode)}
                          class="dropdown-add-btn"
                        >
                          <PlusIcon size={16} />
                          Add
                        </button>
                      </div>
                    ))}
                    {filteredTeams.length === 0 && (
                      <div class="dropdown-empty">
                        {[...addedTeamCodes].some((code) =>
                          getTeamFullName(code).toLowerCase().includes(searchTerm.toLowerCase())
                        )
                          ? "Team already added"
                          : "No teams found"}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === "player" ? (
        <SalaryCalculator
          players={players}
          featuredPlayers={featuredPlayers}
          addedPlayerNames={addedPlayerNames}
          onPlayerAdded={handlePlayerAdded}
          onPlayerRemoved={handlePlayerRemoved}
        />
      ) : (
        <TeamsComparison
          players={players}
          featuredTeamCodes={featuredTeamCodes}
          addedTeamCodes={addedTeamCodes}
          onTeamAdded={handleTeamAdded}
          onTeamRemoved={handleTeamRemoved}
        />
      )}
    </>
  );
}
