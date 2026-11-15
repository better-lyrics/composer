import { msFromSeconds } from "insync/time";
import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "insync/line";
import type { WordTiming } from "insync/word-timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type AlignedTimings = Record<string, string>;

// -- Functions ----------------------------------------------------------------

type TimeKey = (seconds: number) => string | number;

// Whole milliseconds, as a save keeps them, so a mark taken in a session still matches after a reload.
const savedTimeKey: TimeKey = msFromSeconds;
// What projects saved before format 4 stored; only the upgrade reads it.
const v3TimeKey: TimeKey = (seconds) => seconds.toFixed(3);

function trackFingerprint(words: readonly WordTiming[] | undefined, key: TimeKey): string {
  return (words ?? []).map((word) => `${key(word.begin)}-${key(word.end)}`).join(",");
}

function fingerprintBy(line: LyricLine, key: TimeKey): string {
  return `${trackFingerprint(drawnSyllables(line, "main", getSplitCharacter()), key)}|${trackFingerprint(drawnSyllables(line, "bg", getSplitCharacter()), key)}`;
}

function timingFingerprint(line: LyricLine): string {
  return fingerprintBy(line, savedTimeKey);
}

function v3TimingFingerprint(line: LyricLine): string {
  return fingerprintBy(line, v3TimeKey);
}

function fingerprintChanged(before: LyricLine | undefined, after: LyricLine): boolean {
  return before !== undefined && before !== after && timingFingerprint(before) !== timingFingerprint(after);
}

function readAlignedTimings(value: unknown): AlignedTimings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

// -- Exports ------------------------------------------------------------------

export { readAlignedTimings, fingerprintChanged, timingFingerprint, v3TimingFingerprint };
export type { AlignedTimings };
