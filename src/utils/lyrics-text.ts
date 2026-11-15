import { withShownBackground } from "insync/edit-text-shown-background";
import { withoutBackground } from "insync/line-background";
import { lineFromFields } from "insync/line-from-fields";
import { joinedLines } from "insync/line-joined-lines";
import type { LyricLine, MainTrack } from "insync/line";
import { reconcileMatchedTiming } from "insync/line-reconcile-text";
import { backgroundText, lineText, trackText } from "insync/line-text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "insync/line-track";
import { joinedRowRun } from "@/utils/lyrics-text-joined-rows";
import { getSplitCharacter } from "@/utils/split-character";
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
  const textToCandidates = new Map<string, LyricLine[]>();
  const existingTrackKeys = existingLines.map((line) => mainTrackKeys(mainTrack(line), splitChar));
  const existingKeys = existingTrackKeys.map((keys) => keys.ownKey);
  existingLines.forEach((line, index) => {
    const key = existingKeys[index];
    let bucket = textToCandidates.get(key);
    if (!bucket) {
      bucket = [];
      textToCandidates.set(key, bucket);
    }
    bucket.push(line);
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
    if (!usedExistingIds.has(candidates[0].id)) claim(index, candidates[0]);
  });

  const existingIndex = new Map(existingLines.map((line, index) => [line.id, index]));
  const joinedCounts = new Map<number, number>();
  const expectedIndex = (row: number): number => {
    for (let before = row - 1; before >= 0; before--) {
      const line = claimed[before];
      if (line) return (existingIndex.get(line.id) ?? before) + (joinedCounts.get(before) ?? 1) - 1 + row - before;
    }
    for (let after = row + 1; after < claimed.length; after++) {
      const line = claimed[after];
      if (line) return (existingIndex.get(line.id) ?? after) - (after - row);
    }
    return row;
  };
  // Rows joined in Edit spell the text of adjacent lines with no line of their own, so they keep those lines' timing.
  if (newLines.length < existingLines.length) {
    const lineTexts = existingTrackKeys.map((keys) => keys.text.trim());
    const isFree = (lineIndex: number) => !usedExistingIds.has(existingLines[lineIndex].id);
    cleanedTexts.forEach((row, index) => {
      if (claimed[index] || textToCandidates.has(cleanedKeys[index])) return;
      const run = joinedRowRun(row, lineTexts, isFree, expectedIndex(index));
      const joined = run && joinedLines(existingLines.slice(run.start, run.end + 1), run.seams);
      if (!run || !joined) return;
      claim(index, joined);
      for (const line of existingLines.slice(run.start + 1, run.end + 1)) usedExistingIds.add(line.id);
      joinedCounts.set(index, run.end - run.start + 1);
    });
  }

  cleanedKeys.forEach((key, index) => {
    if (claimed[index]) return;
    const candidates = textToCandidates.get(key)?.filter((line) => !usedExistingIds.has(line.id));
    if (!candidates?.length) return;
    const expected = expectedIndex(index);
    const distance = (line: LyricLine) => Math.abs((existingIndex.get(line.id) ?? 0) - expected);
    claim(
      index,
      candidates.reduce((nearest, line) => (distance(line) < distance(nearest) ? line : nearest)),
    );
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
