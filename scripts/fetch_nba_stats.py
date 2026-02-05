"""
Fetch current season NBA player stats from the NBA API

This script uses the nba_api package to fetch player statistics
(average minutes per game and games played) and saves them to a JSON file
that can be merged into the Deno KV database.

Usage: python scripts/fetch_nba_stats.py

Requirements: pip install nba_api
"""

from nba_api.stats.endpoints import leaguedashplayerstats, leaguegamelog
import json
import time
import os
from collections import defaultdict

# How many recent games to check for "currently healthy" status
RECENT_GAMES_WINDOW = 10


def fetch_recent_games_played():
    """
    Fetch recent game logs to determine which players have played recently.

    Returns a dictionary mapping player names to how many of the last
    RECENT_GAMES_WINDOW league games they've played in.
    """
    print(f"🏀 Fetching recent game logs (last {RECENT_GAMES_WINDOW} league games)...")

    # Fetch league-wide game log for the current season
    # This gives us every player's game-by-game results
    game_log = leaguegamelog.LeagueGameLog(
        season_type_all_star='Regular Season',
        player_or_team_abbreviation='P'  # P for Player
    )

    time.sleep(1)  # Be respectful to the API

    data = game_log.get_normalized_dict()
    games = data['LeagueGameLog']

    # Find the most recent game dates
    # Game dates are in 'GAME_DATE' field (format: 'YYYY-MM-DD')
    game_dates = sorted(set(g['GAME_DATE'] for g in games), reverse=True)

    # Get the last N unique game dates (league-wide)
    recent_dates = set(game_dates[:RECENT_GAMES_WINDOW])

    print(f"   Looking at games from {min(recent_dates)} to {max(recent_dates)}")

    # Count how many recent games each player appeared in
    recent_games_by_player = defaultdict(int)

    for game in games:
        if game['GAME_DATE'] in recent_dates:
            player_name = game['PLAYER_NAME']
            recent_games_by_player[player_name] += 1

    print(f"   Found {len(recent_games_by_player)} players with recent games")
    return dict(recent_games_by_player)


def fetch_player_stats(recent_games_played):
    """
    Fetch player stats from the NBA API.

    Returns a dictionary where keys are player names and values contain
    their average minutes per game, games played, and recent games played.
    """
    print("🏀 Fetching player stats from NBA API...")

    # Get league-wide player stats for the current season
    # per_mode_detailed='PerGame' gives us per-game averages
    stats = leaguedashplayerstats.LeagueDashPlayerStats(
        per_mode_detailed='PerGame',
        season_type_all_star='Regular Season'
    )

    # Be respectful to the NBA API - add a small delay
    time.sleep(1)

    # Get the data as a dictionary
    data = stats.get_normalized_dict()

    # Build our result dictionary
    # Keys are player names, values have avgMinutes, gamesPlayed, and recentGamesPlayed
    result = {}

    for player in data['LeagueDashPlayerStats']:
        player_name = player['PLAYER_NAME']
        result[player_name] = {
            'avgMinutes': round(player['MIN'], 1),
            'gamesPlayed': player['GP'],
            'team': player['TEAM_ABBREVIATION'],
            'recentGamesPlayed': recent_games_played.get(player_name, 0)
        }

    print(f"   Found {len(result)} players")
    return result


def main():
    """Main function to fetch stats and save to JSON."""
    try:
        # First fetch recent game data to see who's playing lately
        recent_games = fetch_recent_games_played()

        # Then fetch season stats, including the recent games data
        stats = fetch_player_stats(recent_games)

        # Figure out where to save the file (same directory as this script)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_path = os.path.join(script_dir, 'nba_stats.json')

        # Save to JSON file
        with open(output_path, 'w') as f:
            json.dump(stats, f, indent=2)

        print(f"✅ Saved stats to {output_path}")
        print("   Next step: run 'deno task merge-stats' to update KV")

    except Exception as e:
        print(f"❌ Error fetching stats: {e}")
        print("   Make sure you have nba_api installed: pip install nba_api")
        raise


if __name__ == '__main__':
    main()
