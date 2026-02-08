#!/bin/bash
# Fetches fresh NBA stats and merges them into the database.
# Combines two steps into one command:
#   1. Fetch stats from the NBA API (Python)
#   2. Merge stats into the KV database (Deno)

set -e

echo ""
echo "=== Updating Player Stats ==="
echo ""

echo "Step 1: Fetching stats from NBA API..."
echo ""
uv run python scripts/fetch_nba_stats.py

echo ""
echo "Step 2: Merging stats into database..."
echo ""
deno task merge-stats

echo ""
echo "=== Done! Stats fetched and merged. ==="
