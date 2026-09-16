import { parse } from "jsr:@std/csv@1.0.6";
import { normalizeName } from "./name-utils.ts";

export interface DarkoHistoryPoint {
  date: string;
  darko: number;
  source: string;
}

function parseDarkoValue(raw: string): number | null {
  const cleaned = raw
    .replace(/\uFEFF/g, "")
    .replace(/[^0-9.+-]/g, "")
    .trim();

  if (!cleaned) return null;

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function detectColumns(csvText: string): string[] {
  const headerLine = csvText.split(/\r?\n/)[0] ?? "";
  const header = headerLine
    .replace(/\uFEFF/g, "")
    .split(",")
    .map((part) => part.trim());

  if (header.some((entry) => /\bPlayer\b/i.test(entry))) {
    return header;
  }

  return ["#", "Player", "Team", "Pos", "DPM", "ODPM"];
}

function getCsvDate(fileName: string): string | null {
  const match = fileName.match(/DARKO_player_talent_(\d{4}-\d{2}-\d{2})\.csv/);
  return match?.[1] ?? null;
}

export async function getDarkoHistoryMap(): Promise<
  Record<string, DarkoHistoryPoint[]>
> {
  const darkoDir = new URL("../data/darko/", import.meta.url);
  const historyMap: Record<string, DarkoHistoryPoint[]> = {};

  for await (const entry of Deno.readDir(darkoDir)) {
    if (!entry.isFile || !entry.name.endsWith(".csv")) continue;

    const date = getCsvDate(entry.name);
    if (!date) continue;

    const csvPath = new URL(entry.name, darkoDir);
    const csvText = await Deno.readTextFile(csvPath);
    const records = parse(csvText, {
      skipFirstRow: true,
      columns: detectColumns(csvText),
    }) as Record<string, string>[];

    for (const record of records) {
      const playerName = record.Player ?? record.player;
      const darkoValue = parseDarkoValue(
        String(record.DPM ?? record.dpm ?? ""),
      );

      if (!playerName || darkoValue === null) continue;

      const normalized = normalizeName(playerName);
      const existing = historyMap[normalized] ?? [];
      existing.push({
        date,
        darko: Math.round(darkoValue * 100) / 100,
        source: entry.name,
      });
      historyMap[normalized] = existing;
    }
  }

  for (const key of Object.keys(historyMap)) {
    historyMap[key].sort((a, b) => a.date.localeCompare(b.date));
    // Cap to the 10 most recent entries to keep payload size bounded as CSVs accumulate.
    historyMap[key] = historyMap[key].slice(-10);
  }

  return historyMap;
}
