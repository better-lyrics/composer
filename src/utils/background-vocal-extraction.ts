import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { reconstructLineText, wordContentSpans } from "@/domain/line/reconstruct-text";
import type { WordTiming } from "@/domain/word/timing";
import { remapWordTextsPreservingTiming } from "@/utils/lyrics-text";
import { getSplitCharacter } from "@/utils/split-character";
import { createInitialBgWords } from "@/utils/sync-helpers";

// -- Types --------------------------------------------------------------------

interface ParenGroup {
  inner: string;
  start: number;
  end: number;
}

type ParenScanStatus = "balanced" | "unbalanced" | "nested";

interface ParenScan {
  status: ParenScanStatus;
  groups: ParenGroup[];
}

type LineClassKind = "none" | "inline" | "standalone" | "skip";

interface LineClassification {
  kind: LineClassKind;
  groups: ParenGroup[];
  bgText: string;
  mainText: string;
}

// -- Scanner ------------------------------------------------------------------

function scanParenGroups(text: string): ParenScan {
  const groups: ParenGroup[] = [];
  let depth = 0;
  let openIndex = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      depth++;
      if (depth > 1) return { status: "nested", groups: [] };
      openIndex = i;
    } else if (ch === ")") {
      depth--;
      if (depth < 0) return { status: "unbalanced", groups: [] };
      groups.push({ inner: text.slice(openIndex + 1, i), start: openIndex, end: i });
    }
  }
  if (depth !== 0) return { status: "unbalanced", groups: [] };
  return { status: "balanced", groups };
}

// -- Classification -----------------------------------------------------------

function stripGroups(text: string, groups: ParenGroup[]): string {
  let result = text;
  for (let i = groups.length - 1; i >= 0; i--) {
    result = result.slice(0, groups[i].start) + result.slice(groups[i].end + 1);
  }
  return result;
}

function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, " ").trim();
}

function joinBackgroundText(existing: string | undefined, addition: string): string {
  const base = existing?.trim() ?? "";
  return base.length > 0 ? `${base} ${addition}` : addition;
}

function classifyLine(text: string): LineClassification {
  const scan = scanParenGroups(text);
  if (scan.status !== "balanced") return { kind: "skip", groups: [], bgText: "", mainText: text };
  if (scan.groups.length === 0) return { kind: "none", groups: [], bgText: "", mainText: text };
  const bgText = scan.groups
    .map((g) => g.inner.trim())
    .filter((s) => s.length > 0)
    .join(" ");
  if (bgText.length === 0) return { kind: "none", groups: scan.groups, bgText: "", mainText: text };
  const mainText = collapseSpaces(stripGroups(text, scan.groups));
  return { kind: mainText.length === 0 ? "standalone" : "inline", groups: scan.groups, bgText, mainText };
}

// -- Extraction ---------------------------------------------------------------

function extractInlineWordSynced(line: LyricLine, classified: LineClassification): LyricLine {
  const words = line.words;
  if (!words || words.length === 0) return line;
  if (line.backgroundWords && line.backgroundWords.length > 0) return line;
  const splitChar = getSplitCharacter();
  if (reconstructLineText(words, splitChar) !== line.text) return line;
  const spans = wordContentSpans(words, splitChar);
  const survivors: WordTiming[] = [];
  for (let i = 0; i < words.length; i++) {
    const span = spans[i];
    let insideCount = 0;
    for (const g of classified.groups) {
      const groupStart = g.start;
      const groupEnd = g.end + 1;
      const overlaps = span.start < groupEnd && span.end > groupStart;
      if (!overlaps) continue;
      const fullyInside = span.start >= groupStart && span.end <= groupEnd;
      if (!fullyInside) return line;
      insideCount++;
    }
    if (insideCount === 0) survivors.push(words[i]);
  }
  if (survivors.length === 0) return line;
  const trimmedSurvivors = survivors.map((word, i) =>
    i === survivors.length - 1 ? { ...word, text: word.text.replace(/ +$/, "") } : word,
  );
  return reconcileLine({
    ...line,
    words: trimmedSurvivors,
    text: reconstructLineText(trimmedSurvivors, splitChar),
    backgroundText: joinBackgroundText(line.backgroundText, classified.bgText),
  });
}

function extractInlineFromLine(line: LyricLine): LyricLine {
  const classified = classifyLine(line.text);
  if (classified.kind !== "inline") return line;
  if (isWordSynced(line)) return extractInlineWordSynced(line, classified);
  return {
    ...line,
    text: classified.mainText,
    backgroundText: joinBackgroundText(line.backgroundText, classified.bgText),
  };
}

// -- Whole-list transform -----------------------------------------------------

interface ExtractOptions {
  mergeStandaloneLines: boolean;
}

function carriedBackgroundWords(standalone: LyricLine, bgText: string): WordTiming[] | null {
  const words = standalone.words;
  if (words && words.length > 0) return remapWordTextsPreservingTiming(words, bgText);
  if (isLineSynced(standalone)) return createInitialBgWords(bgText, standalone.begin, standalone.end);
  return null;
}

function mergeStandaloneInto(prev: LyricLine, standalone: LyricLine, bgText: string): LyricLine | null {
  const carried = carriedBackgroundWords(standalone, bgText);
  const prevBgWords = prev.backgroundWords;

  if (carried && carried.length > 0) {
    if (prevBgWords && prevBgWords.length > 0) {
      const combined = [...prevBgWords, ...carried];
      return { ...prev, backgroundWords: combined, backgroundText: reconstructLineText(combined, getSplitCharacter()) };
    }
    if (!prev.backgroundText) {
      return { ...prev, backgroundWords: carried, backgroundText: reconstructLineText(carried, getSplitCharacter()) };
    }
    return { ...prev, backgroundText: joinBackgroundText(prev.backgroundText, bgText) };
  }

  if (prevBgWords && prevBgWords.length > 0) return null;
  return { ...prev, backgroundText: joinBackgroundText(prev.backgroundText, bgText) };
}

function extractBackgroundVocals(lines: LyricLine[], options: ExtractOptions): LyricLine[] {
  const result: LyricLine[] = [];
  for (const line of lines) {
    const classified = classifyLine(line.text);
    if (classified.kind === "inline") {
      result.push(extractInlineFromLine(line));
      continue;
    }
    if (classified.kind === "standalone" && options.mergeStandaloneLines) {
      const prev = result[result.length - 1];
      if (
        prev &&
        prev.text.trim().length > 0 &&
        classifyLine(prev.text).kind === "none" &&
        !isLinked(prev) &&
        !isLinked(line)
      ) {
        const merged = mergeStandaloneInto(prev, line, classified.bgText);
        if (merged) {
          result[result.length - 1] = merged;
          continue;
        }
      }
    }
    result.push(line);
  }
  return result;
}

function lineHasInlineParens(line: LyricLine): boolean {
  return classifyLine(line.text).kind === "inline";
}

// -- Exports ------------------------------------------------------------------

export { classifyLine, extractBackgroundVocals, extractInlineFromLine, lineHasInlineParens, scanParenGroups };
export type { ExtractOptions, LineClassification, LineClassKind, ParenGroup, ParenScan, ParenScanStatus };
