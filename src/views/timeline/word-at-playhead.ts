import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { sameWordSelection } from "@/domain/selection/identity";
import type { BoundaryEdge } from "@/domain/word/boundary";
import type { WordTiming } from "@/domain/word/timing";

// -- Functions -----------------------------------------------------------------

function findWordsAtTime(lines: LyricLine[], time: number): WordSelection[] {
  const matches: WordSelection[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line.words) {
      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex++) {
        const word = line.words[wordIndex];
        if (time >= word.begin && time < word.end) {
          matches.push({ lineId: line.id, lineIndex, wordIndex, type: "word" });
        }
      }
    }
    if (line.backgroundWords) {
      for (let wordIndex = 0; wordIndex < line.backgroundWords.length; wordIndex++) {
        const word = line.backgroundWords[wordIndex];
        if (time >= word.begin && time < word.end) {
          matches.push({ lineId: line.id, lineIndex, wordIndex, type: "bg" });
        }
      }
    }
  }
  return matches;
}

function pickNextWordAtPlayhead(matches: WordSelection[], selectedWords: WordSelection[]): WordSelection | null {
  if (matches.length === 0) return null;
  if (selectedWords.length === 1) {
    const current = selectedWords[0];
    const index = matches.findIndex((match) => sameWordSelection(match, current));
    if (index >= 0) return matches[(index + 1) % matches.length];
  }
  return matches[0];
}

function distanceToWord(word: WordTiming, time: number): number {
  if (!Number.isFinite(word.begin) || !Number.isFinite(word.end)) return Number.POSITIVE_INFINITY;
  if (time >= word.begin && time < word.end) return 0;
  return Math.min(Math.abs(word.begin - time), Math.abs(time - word.end));
}

function nearestWordToTime(lines: LyricLine[], time: number): WordSelection | null {
  let nearest: WordSelection | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const tracks: Array<[readonly WordTiming[] | undefined, WordSelection["type"]]> = [
      [line.words, "word"],
      [line.backgroundWords, "bg"],
    ];
    for (const [words, type] of tracks) {
      if (!words) continue;
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        const distance = distanceToWord(words[wordIndex], time);
        if (distance >= nearestDistance) continue;
        nearestDistance = distance;
        nearest = { lineId: line.id, lineIndex, wordIndex, type };
      }
    }
  }
  return nearest;
}

// Containment keeps the main/background cycle intact, and a contained hit must not
// move the playhead: snapping it to the word's begin would push it clear of an
// overlapping background word and break the cycle on the next press. Only a
// playhead parked in a gap reaches for the nearest word and travels to it.
function selectionForPlayhead(
  lines: LyricLine[],
  time: number,
  selectedWords: WordSelection[],
): { selection: WordSelection; fromGap: boolean } | null {
  const matches = findWordsAtTime(lines, time);
  if (matches.length > 0) {
    const contained = pickNextWordAtPlayhead(matches, selectedWords);
    return contained ? { selection: contained, fromGap: false } : null;
  }
  const nearest = nearestWordToTime(lines, time);
  return nearest ? { selection: nearest, fromGap: true } : null;
}

function nearestInTrack(
  words: readonly WordTiming[] | undefined,
  time: number,
  edge: BoundaryEdge,
): { wordIndex: number; distance: number } | null {
  if (!words) return null;
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex];
    const reachable = edge === "begin" ? word.begin > time : word.end <= time;
    if (!reachable) continue;
    const distance = edge === "begin" ? word.begin - time : time - word.end;
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearestIndex = wordIndex;
  }
  return nearestIndex === -1 ? null : { wordIndex: nearestIndex, distance: nearestDistance };
}

function findWordAcrossGap(lines: LyricLine[], time: number, edge: BoundaryEdge): WordSelection | null {
  let nearest: WordSelection | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const main = nearestInTrack(line.words, time, edge);
    if (main && main.distance < nearestDistance) {
      nearestDistance = main.distance;
      nearest = { lineId: line.id, lineIndex, wordIndex: main.wordIndex, type: "word" };
    }
    const background = nearestInTrack(line.backgroundWords, time, edge);
    if (background && background.distance < nearestDistance) {
      nearestDistance = background.distance;
      nearest = { lineId: line.id, lineIndex, wordIndex: background.wordIndex, type: "bg" };
    }
  }
  return nearest;
}

// The end edge will not claim a word the playhead has only just entered, since setting
// that word's end back to its own begin just collapses it to the minimum duration. It
// falls through to the gap search and lands on the word before instead.
function containsForEdge(word: WordTiming, time: number, edge: BoundaryEdge): boolean {
  const startedBefore = edge === "begin" ? time >= word.begin : time > word.begin;
  return startedBefore && time < word.end;
}

function findContainingWord(lines: LyricLine[], time: number, edge: BoundaryEdge): WordSelection | null {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const mainIndex = line.words?.findIndex((word) => containsForEdge(word, time, edge)) ?? -1;
    if (mainIndex !== -1) return { lineId: line.id, lineIndex, wordIndex: mainIndex, type: "word" };
    const bgIndex = line.backgroundWords?.findIndex((word) => containsForEdge(word, time, edge)) ?? -1;
    if (bgIndex !== -1) return { lineId: line.id, lineIndex, wordIndex: bgIndex, type: "bg" };
  }
  return null;
}

// Containment resolves first, so anything the gap search still sees lies wholly on one
// side of the playhead and can be ranked by plain distance.
function findBoundaryTarget(lines: LyricLine[], time: number, edge: BoundaryEdge): WordSelection | null {
  return findContainingWord(lines, time, edge) ?? findWordAcrossGap(lines, time, edge);
}

// -- Exports -------------------------------------------------------------------

export { findBoundaryTarget, findWordsAtTime, pickNextWordAtPlayhead, selectionForPlayhead };
