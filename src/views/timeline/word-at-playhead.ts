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

// Containment resolves first, so anything the gap search still sees lies wholly on one
// side of the playhead and can be ranked by plain distance.
function findBoundaryTarget(lines: LyricLine[], time: number, edge: BoundaryEdge): WordSelection | null {
  return findWordsAtTime(lines, time)[0] ?? findWordAcrossGap(lines, time, edge);
}

// -- Exports -------------------------------------------------------------------

export { findBoundaryTarget, findWordsAtTime, pickNextWordAtPlayhead };
