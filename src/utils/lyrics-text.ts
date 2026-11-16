import { withShownBackground } from "insync/edit-text-shown-background";
import { withoutBackground } from "insync/line-background";
import { lineFromFields } from "insync/line-from-fields";
import { joinedLines } from "insync/line-joined-lines";
import type { LyricLine, MainTrack } from "insync/line";
import { reconcileMatchedTiming } from "insync/line-reconcile-text";
import { backgroundText, lineText, trackText } from "insync/line-text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "insync/line-track";
import { joinedRowRun, startSearchesByText } from "@/utils/lyrics-text-joined-rows";
import { getSplitCharacter } from "@/utils/split-character";
import { type NearestAccepted, nearestAcceptedSearch } from "@/utils/nearest-accepted";
import { cleanSplitCharacters, withoutSplitCharacter } from "insync/split-character-text";
import { memoBySplitCharacter } from "insync/memo-by-identity";

// -- Types --------------------------------------------------------------------

interface RowKeys {
  cleaned: string;
  key: string;
}

// -- Helpers ------------------------------------------------------------------

function matchKey(text: string, splitChar: string): string {
  return withoutSplitCharacter(cleanSplitCharacters(text.trim(), splitChar), splitChar);
}

function rowKeys(row: string, splitChar: string): RowKeys {
  const cleaned = cleanSplitCharacters(row.trim(), splitChar);
  return { cleaned, key: matchKey(cleaned, splitChar) };
}

// A row still showing its line's text reads the same as that text, so each main track is read once, not per keystroke.
const mainTrackKeys = memoBySplitCharacter((track: MainTrack, splitChar: string) => {
  const text = trackText(track, splitChar);
  return { text, ownKey: matchKey(text, splitChar), row: rowKeys(text, splitChar) };
});

function carriesBackground(line: LyricLine): boolean {
  return (
    backgroundText(line, getSplitCharacter()) !== undefined ||
    roleWords(line, "bg") !== undefined ||
    backgroundTrack(line)?.source !== undefined
  );
}

function keepsNoTimedBackground(line: LyricLine, source: LyricLine | undefined, splitChar: string): boolean {
  const sourceText = source && cleanSplitCharacters(trackText(mainTrack(source), splitChar).trim(), splitChar);
  return sourceText !== trackText(mainTrack(line), splitChar) || !timedSyllables(backgroundTrack(line)).length;
}

// Where the claimed rows around a row place it among the existing lines. Rows are asked in ascending order within one
// pass, and a pass claims only the row it is on, so the rows after it are fixed when the pass starts.
function rowPlacement(
  claimed: readonly (LyricLine | undefined)[],
  existingIndex: ReadonlyMap<string, number>,
  joinedCounts: ReadonlyMap<number, number>,
): (row: number) => number {
  const nextClaimed = new Array<number>(claimed.length + 1).fill(-1);
  for (let row = claimed.length - 1; row >= 0; row--) nextClaimed[row] = claimed[row] ? row : nextClaimed[row + 1];
  let previous = -1;
  let scanned = 0;
  return (row) => {
    for (; scanned < row; scanned++) if (claimed[scanned]) previous = scanned;
    const before = previous >= 0 ? claimed[previous] : undefined;
    if (before) {
      const lineIndex = existingIndex.get(before.id) ?? previous;
      return lineIndex + (joinedCounts.get(previous) ?? 1) - 1 + row - previous;
    }
    const after = nextClaimed[row + 1];
    const afterLine = after >= 0 ? claimed[after] : undefined;
    return afterLine ? (existingIndex.get(afterLine.id) ?? after) - (after - row) : row;
  };
}

// `text` is the typed text or its rows. `splitChar` is the character it was written with, which reads the existing
// lines the same way.
// `shownBackgrounds` holds each row's inline background when the text shows backgrounds inline.
function textToLyricLines(
  text: string | readonly string[],
  defaultAgentId: string,
  existingLines: LyricLine[] = [],
  splitChar = getSplitCharacter(),
  shownBackgrounds?: readonly (string | null)[],
): LyricLine[] {
  const textToCandidates = new Map<string, number[]>();
  const existingTrackKeys = existingLines.map((line) => mainTrackKeys(mainTrack(line), splitChar));
  const existingKeys = existingTrackKeys.map((keys) => keys.ownKey);
  existingKeys.forEach((key, index) => {
    const bucket = textToCandidates.get(key);
    if (bucket) bucket.push(index);
    else textToCandidates.set(key, [index]);
  });

  const usedExistingIds = new Set<string>();
  const newLines = typeof text === "string" ? text.split("\n") : text;
  // Position-based fallback only makes sense when the user is editing-in-place
  // (same number of typed lines as existing lines). If the count changed, the
  // user inserted or deleted rows: position-match would silently overwrite the
  // wrong existing line, so we generate a fresh id for any unmatched typed line.
  const allowPositionMatch = newLines.length === existingLines.length;

  const typedKeys = newLines.map((row, index) => {
    const existing = existingTrackKeys[index];
    return existing?.text === row ? existing.row : rowKeys(row, splitChar);
  });
  const cleanedTexts = typedKeys.map((keys) => keys.cleaned);
  const cleanedKeys = typedKeys.map((keys) => keys.key);
  const claimed: Array<LyricLine | undefined> = new Array(newLines.length);
  const claim = (index: number, line: LyricLine) => {
    claimed[index] = line;
    usedExistingIds.add(line.id);
  };

  // Rows still showing their own line's text keep that line before any row can
  // match it by text, so fixing a line into a later duplicate cannot steal it.
  if (allowPositionMatch) {
    cleanedKeys.forEach((_, index) => {
      if (existingKeys[index] === cleanedKeys[index]) claim(index, existingLines[index]);
    });
  }

  // A row whose text one line alone holds anchors the rows around it; a repeated row then takes the free line
  // nearest where the anchors place it.
  const rowsPerKey = new Map<string, number>();
  for (const key of cleanedKeys) rowsPerKey.set(key, (rowsPerKey.get(key) ?? 0) + 1);
  cleanedKeys.forEach((key, index) => {
    const candidates = textToCandidates.get(key);
    if (claimed[index] || candidates?.length !== 1 || rowsPerKey.get(key) !== 1) return;
    if (!usedExistingIds.has(existingLines[candidates[0]].id)) claim(index, existingLines[candidates[0]]);
  });

  const existingIndex = new Map(existingLines.map((line, index) => [line.id, index]));
  const joinedCounts = new Map<number, number>();
  // Rows joined in Edit spell the text of adjacent lines with no line of their own, so they keep those lines' timing.
  if (newLines.length < existingLines.length) {
    const lineTexts = existingTrackKeys.map((keys) => keys.text.trim());
    const isFree = (lineIndex: number) => !usedExistingIds.has(existingLines[lineIndex].id);
    const startSearches = startSearchesByText(lineTexts, isFree);
    const joinPlacement = rowPlacement(claimed, existingIndex, joinedCounts);
    cleanedTexts.forEach((row, index) => {
      if (claimed[index] || textToCandidates.has(cleanedKeys[index])) return;
      const run = joinedRowRun(row, lineTexts, startSearches, isFree, joinPlacement(index));
      const joined = run && joinedLines(existingLines.slice(run.start, run.end + 1), run.seams);
      if (!run || !joined) return;
      claim(index, joined);
      for (const line of existingLines.slice(run.start + 1, run.end + 1)) usedExistingIds.add(line.id);
      joinedCounts.set(index, run.end - run.start + 1);
    });
  }

  const expectedIndex = rowPlacement(claimed, existingIndex, joinedCounts);
  const isUsed = (lineIndex: number) => usedExistingIds.has(existingLines[lineIndex].id);
  const freeLine = (lineIndex: number) => (isUsed(lineIndex) ? null : existingLines[lineIndex]);
  const candidateSearches = new Map<string, NearestAccepted>();
  cleanedKeys.forEach((key, index) => {
    const candidates = textToCandidates.get(key);
    if (claimed[index] || !candidates) return;
    let search = candidateSearches.get(key);
    if (!search) {
      search = nearestAcceptedSearch(candidates, isUsed);
      candidateSearches.set(key, search);
    }
    const nearest = search(expectedIndex(index), freeLine);
    if (nearest) claim(index, nearest.value);
  });

  const sources: Array<LyricLine | undefined> = new Array(newLines.length);
  const mapped = cleanedTexts.map((cleanedText, index) => {
    const matched = claimed[index];
    if (matched) {
      sources[index] = matched;
      return reconcileMatchedTiming(matched, cleanedText, splitChar);
    }

    if (allowPositionMatch) {
      const positionMatch = existingLines[index];
      if (!usedExistingIds.has(positionMatch.id)) {
        usedExistingIds.add(positionMatch.id);
        sources[index] = positionMatch;
        return reconcileMatchedTiming(positionMatch, cleanedText, splitChar);
      }
    }

    return lineFromFields({ id: crypto.randomUUID(), text: cleanedText, agentId: defaultAgentId }, splitChar);
  });

  if (shownBackgrounds) {
    return mapped.map((line, index) => withShownBackground(line, shownBackgrounds[index] ?? null, splitChar));
  }
  // Parentheses in a row stand for its background vocals, so a carried-over background would double on
  // re-extraction. Timed background words on a row the edit left unchanged are kept.
  return mapped.map((line, index) =>
    carriesBackground(line) &&
    keepsNoTimedBackground(line, sources[index], splitChar) &&
    /\([^)]*\)/.test(lineText(line, getSplitCharacter()))
      ? withoutBackground(line)
      : line,
  );
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
