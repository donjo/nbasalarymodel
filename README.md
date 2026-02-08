# nbasalarymodel

> Originally created by [Stephen Noh](https://github.com/StephenNoh/nbasalarymodel). This is a personal fork with modifications.

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) - JavaScript/TypeScript runtime
- [UV](https://github.com/astral-sh/uv) - Python package manager (for the stats fetch script)

### Development

```bash
# Start the development server
deno task dev

# Build for production
deno task build

# Start production server
deno task start
```

## Scripts

### Database Management

**Seed the database** - Populates the Deno KV database with initial player data:

```bash
deno task seed
```

**Check the database** - Inspect what's currently in the KV database:

```bash
deno task check-kv
```

### Updating Player Stats

The quickest way to update stats is the combined command, which fetches from the NBA API and merges into the database in one step:

```bash
deno task update-stats
```

Or you can run the two steps individually:

**Step 1: Fetch fresh stats from the NBA API**

```bash
uv run python scripts/fetch_nba_stats.py
```

This creates/updates `scripts/nba_stats.json` with current season data including average minutes, games played, and team assignments for all NBA players.

**Step 2: Merge the stats into your database**

```bash
deno task merge-stats
```

This reads the JSON file and updates:
- Player stats (avgMinutes, gamesPlayed)
- Team assignments (detects trades/signings and logs any changes)

You'll see output showing how many players matched and any team changes detected:

```
🏀 Merging NBA stats into KV database...
   Loaded 650 players from NBA API
   Found 550 players in KV database

✅ Merge complete!
   Matched: 487 players
   Unmatched: 63 players

🔄 Team changes detected: 3
   Dejounte Murray: ATL → NOP
   Terry Rozier: CHO → MIA
   OG Anunoby: TOR → NYK
```

### Updating DARKO Values

[DARKO](https://apanalytics.shinyapps.io/DARKO/) is the player impact metric used to calculate salaries. Since DARKO doesn't have a public API, updating these values is a two-step manual process:

**Step 1: Download the DARKO CSV**

1. Go to https://apanalytics.shinyapps.io/DARKO/
2. Click the "Download data" button
3. Save the file to the `data/darko/` folder (keep the default filename with the date, like `DARKO_player_talent_2026-02-05.csv`)

The folder keeps historical downloads, which could enable future features like showing DARKO trends over time.

**Step 2: Merge the DARKO values into your database**

```bash
deno task merge-darko
```

The script automatically finds the most recent CSV (by date in the filename) and updates player DARKO values. You'll see output showing which players had notable changes:

```
🏀 Merging DARKO data...
   Using: data/darko/DARKO_player_talent_2026-02-05.csv
   Data date: 2026-02-05
   Found 526 players in CSV
   Found 535 players in database

✅ Merge complete!
   Matched: 529 players
   Updated: 45 players with changed DARKO values

   Notable changes:
     Nikola Jokic: 6.75 → 6.71 (↓ -0.04)
     Victor Wembanyama: 5.46 → 5.16 (↓ -0.30)
```

---

## About the Model

> These are Stephen Noh's original readme notes below.

This is a salary model that I built for NBA players that projects current year salary + salary five years into the future. Here is a methodology of how it works. 

The main basis for how to build this model came from Chapter 7 of Seth Partnow's excellent book, The Midrange Theory. Seth outlines the process whereby you pick your favorite adjusted plus-minus metric, multiply by possessions and cost of average win, and come out with a contract valuation. 

In the simplest terms, salary = impact * playing time. In the more nitty-gritty, salary = total minutes / 1475 * (DARKO + 3) * 4.32, where 4.32 is the average cost of a win in 2025-26 dollars). The number 1475 represents the average minutes played in a season by a non-replacement level player. We use a baseline of -3 DARKO for a replacement-level player. There are a few other adjustments made to that initial calculation, which I detail below. 

What this model does better than other ones is solve for the biggest problem of any win projection model or salary model: Inaccurate minutes projections. Being off on minutes projections can make a model look terrible. Most people use Kevin Pelton's projections, which are pretty good and generously made availably by him upon request. A better minutes projection comes from crowd-sourcing them from diehard fans, who have a better pulse on rotations than anyone. 

This model allows each user to come up with their own minutes projection. If it's wrong, it's on you. If you think the DARKO value is off, it also allows you to adjust to what you deem the "correct" value. 

I used Kostya Medvedovsky's DARKO as the APM metric for the basis of this model for a few different reasons. 1) It was ranked as the best in a survey of NBA personnel and stats folks a few years back and 2) Its goal is to be predictive, looking forward, rather than looking back like some other APM metrics. 

This model makes improvements on an older one I built in a couple of different ways. First, there is an aging curve built in, along with inflation baked in for future years from salary cap increases (estimates taken from RealGM). 

This model also tries to sovle for the problem that Parntnow writes about, that "valuing wins can be tricky, as not all wins are created equal." 

Getting from 60 to 65 wins is a lot more valuable than going from 20 to 25. MVP caliber players take you to that level, which is why they are still generally underpaid even on maximum salaries relative to their impact. I improvised a way to tackle that problem, using another curve that tops out at a 10 percent bonus for MVP-caliber players and deducts 10 percent for replacement-level players. 

There are a few improvements which I hope to make to this model down the line, the primary one being a positional adjustment that penalizes small guards/centers and rewards wings. I would like to build in some sort of pidgeon component (how often a player gets targeted, which has been tracked by Todd Whitehead using synergy data) to devalue those defensively-limited players. Along the same lines, my aging curve could be improved by making it position-specific. 

This model also doesn't take into account team/player options and nonguarantees when displaying actual contract data. I may get to that at some point. For now, you can double-check the figures at Spotrac.com. 