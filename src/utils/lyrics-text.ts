import { CLEARED_BACKGROUND } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { reconcileMatchedTiming } from "@/domain/line/reconcile-text";
import { cleanSplitCharacters, stripSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function matchKey(text: string): string {
  return stripSplitCharacter(cleanSplitCharacters(text.trim()));
}

function carriesBackground(line: LyricLine): boolean {
  return (
    line.backgroundText !== undefined || line.backgroundWords !== undefined || line.backgroundTextSource !== undefined
  );
}

function textToLyricLines(text: string, defaultAgentId: string, existingLines: LyricLine[] = []): LyricLine[] {
  const textToCandidates = new Map<string, LyricLine[]>();
  const existingKeys = existingLines.map((line) => matchKey(line.text));
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

  const cleanedTexts = newLines.map((lineText) => cleanSplitCharacters(lineText.trim()));
  const cleanedKeys = cleanedTexts.map(matchKey);
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

  const mapped = cleanedTexts.map((cleanedText, index) => {
    const matched = claimed[index];
    if (matched) return reconcileMatchedTiming(matched, cleanedText);

    if (allowPositionMatch) {
      const positionMatch = existingLines[index];
      if (!usedExistingIds.has(positionMatch.id)) {
        usedExistingIds.add(positionMatch.id);
        return reconcileMatchedTiming(positionMatch, cleanedText);
      }
    }

    return {
      id: crypto.randomUUID(),
      text: cleanedText,
      agentId: defaultAgentId,
    };
  });

  // Raw parentheses in `text` are the source of truth for background vocals;
  // a carried-over extracted backgroundText would double on re-extraction.
  return mapped.map((line) =>
    carriesBackground(line) && /\([^)]*\)/.test(line.text) ? { ...line, ...CLEARED_BACKGROUND } : line,
  );
}

// -- Exports ------------------------------------------------------------------

export { textToLyricLines };
