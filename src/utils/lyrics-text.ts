import { withoutBackground } from "@/domain/line/background";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { backgroundText, lineText, trackText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { cleanSplitCharacters, getSplitCharacter, withoutSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function matchKey(text: string, splitChar: string): string {
  return withoutSplitCharacter(cleanSplitCharacters(text.trim(), splitChar), splitChar);
}

function carriesBackground(line: LyricLine): boolean {
  return (
    backgroundText(line) !== undefined ||
    roleWords(line, "bg") !== undefined ||
    backgroundTrack(line)?.source !== undefined
  );
}

function keepsNoTimedBackground(line: LyricLine, source: LyricLine | undefined, splitChar: string): boolean {
  const sourceText = source && cleanSplitCharacters(trackText(mainTrack(source), splitChar).trim(), splitChar);
  return sourceText !== trackText(mainTrack(line), splitChar) || !timedSyllables(backgroundTrack(line)).length;
}

// `splitChar` is the character the typed text was written with, which reads the existing lines the same way.
function textToLyricLines(
  text: string,
  defaultAgentId: string,
  existingLines: LyricLine[] = [],
  splitChar = getSplitCharacter(),
): LyricLine[] {
  const textToCandidates = new Map<string, LyricLine[]>();
  const existingKeys = existingLines.map((line) => matchKey(trackText(mainTrack(line), splitChar), splitChar));
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
  const newLines = text.split("\n");
  // Position-based fallback only makes sense when the user is editing-in-place
  // (same number of typed lines as existing lines). If the count changed, the
  // user inserted or deleted rows: position-match would silently overwrite the
  // wrong existing line, so we generate a fresh id for any unmatched typed line.
  const allowPositionMatch = newLines.length === existingLines.length;

  const cleanedTexts = newLines.map((row) => cleanSplitCharacters(row.trim(), splitChar));
  const cleanedKeys = cleanedTexts.map((cleaned) => matchKey(cleaned, splitChar));
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

  cleanedKeys.forEach((_, index) => {
    if (claimed[index]) return;
    const exactMatch = textToCandidates.get(cleanedKeys[index])?.find((line) => !usedExistingIds.has(line.id));
    if (exactMatch) claim(index, exactMatch);
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

  // Parentheses in a row stand for its background vocals, so a carried-over background would double on
  // re-extraction. Timed background words on a row the edit left unchanged are kept.
  return mapped.map((line, index) =>
    carriesBackground(line) &&
    keepsNoTimedBackground(line, sources[index], splitChar) &&
    /\([^)]*\)/.test(lineText(line))
      ? withoutBackground(line)
      : line,
  );
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
