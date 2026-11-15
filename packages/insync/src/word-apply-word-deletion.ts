import { getLinkScope, isLinkedSibling, unlinkLines } from "./group-linking";
import { lineInstanceKey } from "./instance-key";
import { withManualBackgroundWords } from "./line-background";
import { drawnSyllables } from "./line-drawn-track";
import type { LyricLine } from "./line";
import { hasAnyTiming, isLineSynced } from "./line-predicates";
import { mainTrack, roleWords } from "./line-track";
import { withMainTrack, withoutTrackTiming, withTrackWords } from "./line-track-writes";
import { selectionIndexesByLine } from "./selection-indexes-by-line";
import { absorbDeletedSyllablesIntoNeighbors } from "./word-syllable-groups";
import type { WordTiming } from "./word-timing";

interface DeletionSelection {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
}

// -- Helpers ------------------------------------------------------------------

function isLineFullyEmpty(line: LyricLine): boolean {
  return !hasAnyTiming(line);
}

// The word left before deleted words takes the seam the last of them had, so the track reads as if they were never there.
function remainingWords(words: readonly WordTiming[], deleted: ReadonlySet<number>): WordTiming[] {
  const remaining: WordTiming[] = [];
  words.forEach((word, index) => {
    if (!deleted.has(index)) remaining.push(word);
    else if (remaining.length > 0)
      remaining[remaining.length - 1] = {
        ...remaining[remaining.length - 1],
        sep: word.sep,
        joinsNext: word.joinsNext,
      };
  });
  return remaining;
}

function trackLength(line: LyricLine, type: "word" | "bg", splitChar: string): number {
  if (type === "bg") return drawnSyllables(line, "bg", splitChar).length;
  return isLineSynced(line) ? 1 : (roleWords(line, "main")?.length ?? 0);
}

function deleteFromLines(
  lines: LyricLine[],
  selections: ReadonlyArray<DeletionSelection>,
  splitChar: string,
): Map<string, LyricLine> {
  const byLine = selectionIndexesByLine(selections);

  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);

  const updatedById = new Map<string, LyricLine>();

  for (const [lineId, { mainIdxs, bgIdxs }] of byLine) {
    const line = linesById.get(lineId);
    if (!line) continue;

    const mainWords = roleWords(line, "main") ?? [];
    const main = mainTrack(line);
    let updatedLine = line;
    if (isLineSynced(line) && mainIdxs.has(0)) {
      updatedLine = withMainTrack(line, withoutTrackTiming(main));
    } else if (mainWords.length > 0 && mainIdxs.size > 0) {
      const nextMain = remainingWords(absorbDeletedSyllablesIntoNeighbors(mainWords, mainIdxs), mainIdxs);
      updatedLine = withMainTrack(
        line,
        nextMain.length > 0 ? withTrackWords(main, nextMain) : withoutTrackTiming(main),
      );
    }

    const bgWords = drawnSyllables(line, "bg", splitChar);
    if (bgWords.length > 0 && bgIdxs.size > 0) {
      const remaining = remainingWords(absorbDeletedSyllablesIntoNeighbors(bgWords, bgIdxs), bgIdxs);
      updatedLine = withManualBackgroundWords(updatedLine, remaining, splitChar);
    }

    updatedById.set(lineId, updatedLine);
  }

  return updatedById;
}

function emptiedInstanceKeys(lines: LyricLine[], updatedById: Map<string, LyricLine>): Set<string> {
  const touched = new Set<string>();
  for (const updated of updatedById.values()) {
    const key = lineInstanceKey(updated);
    if (key) touched.add(key);
  }

  const emptied = new Set(touched);
  for (const line of lines) {
    const key = lineInstanceKey(line);
    if (key && emptied.has(key) && !isLineFullyEmpty(updatedById.get(line.id) ?? line)) emptied.delete(key);
  }
  return emptied;
}

// A partial delete is a structure edit, so it reaches every linked instance; emptying a whole instance clears only that one.
function withLinkedSiblings(
  lines: LyricLine[],
  selections: ReadonlyArray<DeletionSelection>,
  emptied: Set<string>,
  splitChar: string,
): DeletionSelection[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);

  const expanded = [...selections];
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    const scope = line ? getLinkScope(line) : null;
    if (!line || !scope || emptied.has(lineInstanceKey(line) ?? "")) continue;
    for (const sibling of lines) {
      if (sibling.id === line.id || !isLinkedSibling(sibling, scope)) continue;
      if (emptied.has(lineInstanceKey(sibling) ?? "")) continue;
      if (trackLength(sibling, sel.type, splitChar) !== trackLength(line, sel.type, splitChar)) continue;
      expanded.push({ lineId: sibling.id, type: sel.type, wordIndex: sel.wordIndex });
    }
  }
  return expanded;
}

// -- Deletion -----------------------------------------------------------------

function applyWordDeletion(
  lines: LyricLine[],
  selectedWords: ReadonlyArray<DeletionSelection>,
  splitChar: string,
): LyricLine[] {
  if (selectedWords.length === 0) return lines;

  const emptied = emptiedInstanceKeys(lines, deleteFromLines(lines, selectedWords, splitChar));
  const selections = withLinkedSiblings(lines, selectedWords, emptied, splitChar);
  const updatedById = deleteFromLines(lines, selections, splitChar);

  const result = lines.map((line) => updatedById.get(line.id) ?? line);
  if (emptied.size === 0) return result;

  // An emptied instance becomes standalone placeholder rows, so paste-as-instance can refill it without an orphan banner.
  return unlinkLines(result, (line) => emptied.has(lineInstanceKey(line) ?? ""));
}

export type { DeletionSelection };
export { applyWordDeletion };
