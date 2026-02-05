"""
Fetch current season NBA player stats from the NBA API

This script uses the nba_api package to fetch player statistics
(average minutes per game and games played) and saves them to a JSON file
that can be merged into the Deno KV database.

Usage: python scripts/fetch_nba_stats.py

Requirements: pip install nba_api
"""

from nba_api.stats.endpoints import leaguedashplayerstats
import json
import time
import os


def fetch_player_stats():
    """
    Fetch player stats from the NBA API.

    Returns a dictionary where keys are player names and values contain
    their average minutes per game and games played this season.
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
    # Keys are player names, values have avgMinutes and gamesPlayed
    result = {}

    for player in data['LeagueDashPlayerStats']:
        player_name = player['PLAYER_NAME']
        result[player_name] = {
            'avgMinutes': round(player['MIN'], 1),
            'gamesPlayed': player['GP'],
            'team': player['TEAM_ABBREVIATION']
        }

    print(f"   Found {len(result)} players")
    return result


def main():
    """Main function to fetch stats and save to JSON."""
    try:
        # Fetch the stats from NBA API
        stats = fetch_player_stats()

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
