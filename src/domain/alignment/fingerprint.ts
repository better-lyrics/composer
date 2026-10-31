import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type AlignedTimings = Record<string, string>;

// -- Functions ----------------------------------------------------------------

function trackFingerprint(words: readonly WordTiming[] | undefined): string {
  return (words ?? []).map((word) => `${word.begin.toFixed(3)}-${word.end.toFixed(3)}`).join(",");
}

function timingFingerprint(line: LyricLine): string {
  return `${trackFingerprint(effectiveTrackWords(line, "word"))}|${trackFingerprint(effectiveTrackWords(line, "bg"))}`;
}

function readAlignedTimings(value: unknown): AlignedTimings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

// -- Exports ------------------------------------------------------------------

export { readAlignedTimings, timingFingerprint };
export type { AlignedTimings };
