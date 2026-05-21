import { applyBackground } from "@/domain/line/background";
import type { BackgroundSource } from "@/domain/line/background";
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
  const base = line.backgroundTextSource === "extraction" ? undefined : line.backgroundText;
  return applyBackground(
    reconcileLine({
      ...line,
      words: trimmedSurvivors,
      text: reconstructLineText(trimmedSurvivors, splitChar),
    }),
    { text: joinBackgroundText(base, classified.bgText), source: base ? "manual" : "extraction" },
  );
}

function extractInlineFromLine(line: LyricLine): LyricLine {
  const classified = classifyLine(line.text);
  if (classified.kind !== "inline") return line;
  if (isWordSynced(line)) return extractInlineWordSynced(line, classified);
  const base = line.backgroundTextSource === "extraction" ? undefined : line.backgroundText;
  return applyBackground(
    { ...line, text: classified.mainText },
    { text: joinBackgroundText(base, classified.bgText), source: base ? "manual" : "extraction" },
  );
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

function mergeStandaloneInto(
  prev: LyricLine,
  standalone: LyricLine,
  bgText: string,
  prevMergedThisPass: boolean,
): LyricLine | null {
  // On re-paste, prev's extraction-sourced background is stale output from a
  // prior pass, so the standalone line replaces it. Manual background is kept.
  // Extraction-sourced background produced earlier in this same pass (an
  // already-merged standalone) is fresh, so further standalones append to it.
  const prevIsExtraction = prev.backgroundTextSource === "extraction";
  const prevIsStaleExtraction = prevIsExtraction && !prevMergedThisPass;
  const baseText = prevIsStaleExtraction ? undefined : prev.backgroundText;
  const baseWords = prevIsStaleExtraction ? undefined : prev.backgroundWords;
  const carried = carriedBackgroundWords(standalone, bgText);

  // Source for a result that keeps the prev base: a surviving extraction base
  // is necessarily fresh same-pass output (stale extraction was dropped above),
  // so it stays extraction; manual or legacy-undefined stays manual.
  const keptBaseSource: BackgroundSource = prevIsExtraction ? "extraction" : "manual";

  if (carried && carried.length > 0) {
    if (baseWords && baseWords.length > 0) {
      const combined = [...baseWords, ...carried];
      return applyBackground(prev, {
        words: combined,
        text: reconstructLineText(combined, getSplitCharacter()),
        source: keptBaseSource,
      });
    }
    if (!baseText) {
      return applyBackground(prev, {
        words: carried,
        text: reconstructLineText(carried, getSplitCharacter()),
        source: "extraction",
      });
    }
    return applyBackground(prev, { text: joinBackgroundText(baseText, bgText), source: keptBaseSource });
  }

  if (baseWords && baseWords.length > 0) return null;
  return applyBackground(prev, {
    text: joinBackgroundText(baseText, bgText),
    source: baseText ? keptBaseSource : "extraction",
  });
}

function extractBackgroundVocals(lines: LyricLine[], options: ExtractOptions): LyricLine[] {
  const result: LyricLine[] = [];
  // Result indices whose extraction-sourced background was written during this
  // pass. Such content is fresh, so a later standalone appends to it; an
  // extraction-sourced background carried in unchanged is stale prior output
  // that a standalone replaces instead.
  const freshExtractionIndices = new Set<number>();
  for (const line of lines) {
    const classified = classifyLine(line.text);
    if (classified.kind === "inline") {
      const extracted = extractInlineFromLine(line);
      result.push(extracted);
      // extracted === line means nothing was extracted; such a pass-through
      // line may carry stale prior-pass provenance and must not count as fresh.
      if (extracted !== line && extracted.backgroundTextSource === "extraction") {
        freshExtractionIndices.add(result.length - 1);
      }
      continue;
    }
    if (classified.kind === "standalone" && options.mergeStandaloneLines) {
      const prevIndex = result.length - 1;
      const prev = result[prevIndex];
      if (
        prev &&
        prev.text.trim().length > 0 &&
        classifyLine(prev.text).kind === "none" &&
        !isLinked(prev) &&
        !isLinked(line)
      ) {
        const merged = mergeStandaloneInto(prev, line, classified.bgText, freshExtractionIndices.has(prevIndex));
        if (merged) {
          result[prevIndex] = merged;
          if (merged.backgroundTextSource === "extraction") freshExtractionIndices.add(prevIndex);
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
