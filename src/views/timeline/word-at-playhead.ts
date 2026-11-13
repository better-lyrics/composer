import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { type ResolvedAddress, resolvedAt } from "@/domain/selection/resolve";
import type { BoundaryEdge } from "@/domain/word/boundary";
import type { WordTiming } from "@/domain/word/timing";
import { type GroupFocus, isInFocus } from "@/views/timeline/group-focus";

// -- Functions -----------------------------------------------------------------

function findWordsAtTime(lines: LyricLine[], time: number, focus: GroupFocus | null = null): ResolvedAddress[] {
  const matches: ResolvedAddress[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!isInFocus(line, focus)) continue;
    const words = timedSyllables(mainTrack(line));
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      const word = words[wordIndex];
      if (time >= word.begin && time < word.end) {
        matches.push({ lineId: line.id, type: "word", syllableId: word.id, lineIndex, wordIndex });
      }
    }
    const backgroundWords = timedSyllables(backgroundTrack(line));
    for (let wordIndex = 0; wordIndex < backgroundWords.length; wordIndex++) {
      const word = backgroundWords[wordIndex];
      if (time >= word.begin && time < word.end) {
        matches.push({ lineId: line.id, type: "bg", syllableId: word.id, lineIndex, wordIndex });
      }
    }
  }
  return matches;
}

function pickNextWordAtPlayhead(
  matches: ResolvedAddress[],
  selectedWords: readonly SyllableAddress[],
): ResolvedAddress | null {
  if (matches.length === 0) return null;
  if (selectedWords.length === 1) {
    const current = selectedWords[0];
    const index = matches.findIndex((match) => sameAddress(match, current));
    if (index >= 0) return matches[(index + 1) % matches.length];
  }
  return matches[0];
}

function nearestInTrack(
  words: readonly WordTiming[],
  time: number,
  edge: BoundaryEdge,
): { wordIndex: number; distance: number } | null {
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

function findWordAcrossGap(
  lines: LyricLine[],
  time: number,
  edge: BoundaryEdge,
  focus: GroupFocus | null,
  mainOnly: boolean,
): ResolvedAddress | null {
  let nearest: ResolvedAddress | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!isInFocus(line, focus)) continue;
    const main = nearestInTrack(timedSyllables(mainTrack(line)), time, edge);
    if (main && main.distance < nearestDistance) {
      nearestDistance = main.distance;
      nearest = resolvedAt(lines, lineIndex, "word", main.wordIndex);
    }
    const background = mainOnly ? null : nearestInTrack(timedSyllables(backgroundTrack(line)), time, edge);
    if (background && background.distance < nearestDistance) {
      nearestDistance = background.distance;
      nearest = resolvedAt(lines, lineIndex, "bg", background.wordIndex);
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

function findContainingWord(
  lines: LyricLine[],
  time: number,
  edge: BoundaryEdge,
  focus: GroupFocus | null,
  mainOnly: boolean,
): ResolvedAddress | null {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!isInFocus(line, focus)) continue;
    const mainIndex = timedSyllables(mainTrack(line)).findIndex((word) => containsForEdge(word, time, edge));
    if (mainIndex !== -1) return resolvedAt(lines, lineIndex, "word", mainIndex);
    if (mainOnly) continue;
    const bgIndex = timedSyllables(backgroundTrack(line)).findIndex((word) => containsForEdge(word, time, edge));
    if (bgIndex !== -1) return resolvedAt(lines, lineIndex, "bg", bgIndex);
  }
  return null;
}

// Containment resolves first, so anything the gap search still sees lies wholly on one
// side of the playhead and can be ranked by plain distance. Step timing passes mainOnly: its keys skip background words.
function findBoundaryTarget(
  lines: LyricLine[],
  time: number,
  edge: BoundaryEdge,
  focus: GroupFocus | null = null,
  mainOnly = false,
): ResolvedAddress | null {
  return (
    findContainingWord(lines, time, edge, focus, mainOnly) ?? findWordAcrossGap(lines, time, edge, focus, mainOnly)
  );
}

// -- Exports -------------------------------------------------------------------

export { findBoundaryTarget, findWordsAtTime, pickNextWordAtPlayhead };
