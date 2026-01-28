/**
 * AppTabs Island - Handles tab switching between Player and Team views
 * Includes unified search in the navigation bar
 * Manages shareable URL state for player/team selections
 */

import { useState, useEffect, useRef } from "preact/hooks";
import { SearchIcon, PlusIcon } from "../components/Icons.tsx";
import SalaryCalculator from "./SalaryCalculator.tsx";
import TeamsComparison from "./TeamsComparison.tsx";
import Leaderboard from "./Leaderboard.tsx";
import type { Player } from "../lib/players.ts";
import { getTeamFullName, getUniqueTeamCodes } from "../lib/teams.ts";
import {
  encodeStateToURL,
  decodeURLToState,
  getDefaultSettings,
  type PlayerSettings,
} from "../lib/url.ts";

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
  const [activeTab, setActiveTab] = useState<"player" | "team" | "leaderboard">("player");

  // Search state (unified for both tabs)
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Player selections with their custom settings (name -> settings)
  const [playerSelections, setPlayerSelections] = useState<Map<string, PlayerSettings>>(new Map());

  // Team codes that have been added
  const [addedTeamCodes, setAddedTeamCodes] = useState<Set<string>>(new Set());

  // Team player custom settings (player name -> settings)
  const [teamPlayerSettings, setTeamPlayerSettings] = useState<Map<string, PlayerSettings>>(new Map());

  // Track if we've loaded state from URL (to avoid overwriting on mount)
  const hasLoadedFromURL = useRef(false);

  // Derive addedPlayerNames from playerSelections for filtering
  const addedPlayerNames = new Set(playerSelections.keys());

  // Load state from URL on mount
  useEffect(() => {
    if (hasLoadedFromURL.current) return;
    hasLoadedFromURL.current = true;

    const urlState = decodeURLToState(globalThis.location?.search || "");

    if (urlState.activeTab) {
      setActiveTab(urlState.activeTab);
    }

    if (urlState.playerSelections) {
      // Validate player names exist in our data
      const validSelections = new Map<string, PlayerSettings>();
      urlState.playerSelections.forEach((settings, name) => {
        if (players.some((p) => p.name === name)) {
          validSelections.set(name, settings);
        }
      });
      if (validSelections.size > 0) {
        setPlayerSelections(validSelections);
      }
    }

    if (urlState.teamCodes) {
      // Validate team codes
      const allTeamCodes = getUniqueTeamCodes();
      const validCodes = new Set<string>();
      urlState.teamCodes.forEach((code) => {
        if (allTeamCodes.includes(code)) {
          validCodes.add(code);
        }
      });
      if (validCodes.size > 0) {
        setAddedTeamCodes(validCodes);
      }
    }

    if (urlState.teamPlayerSettings) {
      setTeamPlayerSettings(urlState.teamPlayerSettings);
    }
  }, [players]);

  // Update URL when state changes (debounced to avoid too many updates during slider drags)
  const urlUpdateTimeout = useRef<number | null>(null);

  useEffect(() => {
    // Skip if we haven't loaded from URL yet (initial mount)
    if (!hasLoadedFromURL.current) return;

    // Clear any pending update
    if (urlUpdateTimeout.current !== null) {
      clearTimeout(urlUpdateTimeout.current);
    }

    // Debounce URL updates by 300ms
    urlUpdateTimeout.current = setTimeout(() => {
      const urlString = encodeStateToURL({
        activeTab,
        playerSelections,
        teamCodes: addedTeamCodes,
        teamPlayerSettings,
      });

      // Only update if URL would actually change
      const newSearch = urlString ? `?${urlString}` : "";
      if (globalThis.location?.search !== newSearch) {
        globalThis.history?.replaceState(null, "", newSearch || globalThis.location?.pathname);
      }
    }, 300);

    return () => {
      if (urlUpdateTimeout.current !== null) {
        clearTimeout(urlUpdateTimeout.current);
      }
    };
  }, [activeTab, playerSelections, addedTeamCodes, teamPlayerSettings]);

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
    const newSelections = new Map(playerSelections);
    newSelections.set(name, getDefaultSettings());
    setPlayerSelections(newSelections);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handlePlayerRemoved = (name: string) => {
    const newSelections = new Map(playerSelections);
    newSelections.delete(name);
    setPlayerSelections(newSelections);
  };

  // Callback for when player settings change (from SalaryCalculator)
  const handlePlayerSettingsChange = (name: string, settings: PlayerSettings) => {
    const newSelections = new Map(playerSelections);
    newSelections.set(name, settings);
    setPlayerSelections(newSelections);
  };

  // Callback for when team player settings change (from TeamsComparison)
  const handleTeamPlayerSettingsChange = (name: string, settings: PlayerSettings) => {
    const newSettings = new Map(teamPlayerSettings);
    newSettings.set(name, settings);
    setTeamPlayerSettings(newSettings);
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
            <button
              class={`tab-button ${activeTab === "leaderboard" ? "tab-button-active" : ""}`}
              onClick={() => {
                setActiveTab("leaderboard");
                setSearchTerm("");
                setShowDropdown(false);
              }}
            >
              Leaderboard
            </button>
          </div>

          {/* Search Box - hidden on leaderboard tab */}
          {activeTab !== "leaderboard" && (
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
          )}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === "player" && (
        <SalaryCalculator
          players={players}
          featuredPlayers={featuredPlayers}
          playerSelections={playerSelections}
          onPlayerAdded={handlePlayerAdded}
          onPlayerRemoved={handlePlayerRemoved}
          onPlayerSettingsChange={handlePlayerSettingsChange}
        />
      )}
      {activeTab === "team" && (
        <TeamsComparison
          players={players}
          featuredTeamCodes={featuredTeamCodes}
          addedTeamCodes={addedTeamCodes}
          onTeamAdded={handleTeamAdded}
          onTeamRemoved={handleTeamRemoved}
          teamPlayerSettings={teamPlayerSettings}
          onTeamPlayerSettingsChange={handleTeamPlayerSettingsChange}
        />
      )}
      {activeTab === "leaderboard" && (
        <Leaderboard players={players} />
      )}
    </>
  );
}
