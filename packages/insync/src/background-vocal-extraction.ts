import { joinBackgroundText } from "./background-vocal-brackets";
import { mergeStandaloneInto } from "./background-vocal-standalone-merge";
import { isLinked, isSlotLine } from "./instance-predicates";
import type { LineUpdate, LyricLine } from "./line";
import { withBackground, withSeededBackground } from "./line-background";
import { bgBounds } from "./line-bounds";
import { isWordSynced } from "./line-predicates";
import { wordContentSpans } from "./line-reconstruct-text";
import { backgroundText, lineText, syllablesText } from "./line-text";
import { backgroundTrack, mainTrack, roleWords } from "./line-track";
import { withMainTrack, withTrackSyllables, withTrackText } from "./line-track-writes";
import { remapWordTextsPreservingTiming } from "./word-remap-text";
import { wordFromSpaced } from "./word-spaced-words";
import type { WordTiming } from "./word-timing";

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

interface ExtractOptions {
  mergeStandaloneLines: boolean;
  preserveBrackets: boolean;
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

function hasSungContent(text: string, splitChar: string): boolean {
  return [...text].some((char) => !"() ".includes(char) && char !== splitChar);
}

function extractInlineWordSynced(
  line: LyricLine,
  classified: LineClassification,
  options: ExtractOptions,
  splitChar: string,
): LyricLine {
  const words = roleWords(line, "main");
  if (!words || words.length === 0) return line;
  if (bgBounds(line)) return line;
  if (syllablesText(words, splitChar) !== lineText(line, splitChar)) return line;
  const spans = wordContentSpans(words, splitChar);
  const survivors: WordTiming[] = [];
  const bracketed: WordTiming[] = [];
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
    else if (hasSungContent(words[i].text, splitChar)) bracketed.push(words[i]);
  }
  if (survivors.length === 0) return line;
  const trimmedSurvivors = survivors.map((word, i) =>
    i === survivors.length - 1
      ? wordFromSpaced({ ...word, text: (word.text + word.sep).replace(/ +$/, ""), joinsNext: false })
      : word,
  );
  const base = backgroundTrack(line)?.source === "extraction" ? undefined : backgroundText(line, splitChar);
  const joined = joinBackgroundText(base, classified.bgText, options.preserveBrackets, false);
  return withBackground(
    withMainTrack(line, withTrackSyllables(mainTrack(line), trimmedSurvivors)),
    {
      text: joined,
      words: base ? undefined : remapWordTextsPreservingTiming(bracketed, joined, splitChar),
      source: base ? "manual" : "extraction",
    },
    splitChar,
  );
}

function extractInline(line: LyricLine, options: ExtractOptions, splitChar: string): LyricLine {
  const classified = classifyLine(lineText(line, splitChar));
  if (classified.kind !== "inline") return line;
  if (isWordSynced(line)) return extractInlineWordSynced(line, classified, options, splitChar);
  if (bgBounds(line)) return line;
  const base = backgroundTrack(line)?.source === "extraction" ? undefined : backgroundText(line, splitChar);
  return withBackground(
    withMainTrack(line, withTrackText(mainTrack(line), classified.mainText, splitChar)),
    {
      text: joinBackgroundText(base, classified.bgText, options.preserveBrackets, false),
      source: base ? "manual" : "extraction",
    },
    splitChar,
  );
}

function extractInlineFromLine(
  line: LyricLine,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine {
  const extracted = extractInline(line, options, splitChar);
  return extracted === line ? line : withSeededBackground(extracted, splitChar, songEnd);
}

// Other instances of a group line take the extraction from its template.
function extractInlineOnLine(
  lines: LyricLine[],
  lineId: string,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LineUpdate[] {
  const target = lines.find((line) => line.id === lineId);
  if (!target) return [];
  const extracted = extractInlineFromLine(target, options, splitChar, songEnd);
  return extracted === target ? [] : [{ id: lineId, updates: { tracks: extracted.tracks } }];
}

// -- Whole-list transform -----------------------------------------------------

function extractBackgroundVocals(
  lines: LyricLine[],
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine[] {
  const result: LyricLine[] = [];
  const sameSessionWriteIndices = new Set<number>();
  const slotLines = new Map<number, LyricLine>();
  const refusedSlots = new Set<string>();
  const slotOf = (line: LyricLine) => (isSlotLine(line) ? `${line.groupId}\u0000${line.templateLineIdx}` : null);
  for (const line of lines) {
    const classified = classifyLine(lineText(line, splitChar));
    if (classified.kind === "inline") {
      const extracted = extractInline(line, options, splitChar);
      result.push(extracted);
      if (extracted !== line) sameSessionWriteIndices.add(result.length - 1);
      const slot = slotOf(line);
      if (slot !== null) slotLines.set(result.length - 1, line);
      if (slot !== null && extracted === line) refusedSlots.add(slot);
      continue;
    }
    if (classified.kind === "standalone" && options.mergeStandaloneLines) {
      const prevIndex = result.length - 1;
      const prev = result[prevIndex];
      if (
        prev &&
        lineText(prev, splitChar).trim().length > 0 &&
        classifyLine(lineText(prev, splitChar)).kind === "none" &&
        !isLinked(prev) &&
        !isLinked(line)
      ) {
        const merged = mergeStandaloneInto(
          prev,
          line,
          classified.bgText,
          sameSessionWriteIndices.has(prevIndex),
          options.preserveBrackets,
          splitChar,
          songEnd,
        );
        if (merged) {
          result[prevIndex] = merged;
          sameSessionWriteIndices.add(prevIndex);
          continue;
        }
      }
    }
    result.push(line);
  }
  // Linked instances of one template line show one text, so one instance that cannot be extracted keeps them all.
  for (const [index, line] of slotLines) {
    if (!refusedSlots.has(slotOf(line) ?? "")) continue;
    result[index] = line;
    sameSessionWriteIndices.delete(index);
  }
  return result.map((line, index) =>
    sameSessionWriteIndices.has(index) ? withSeededBackground(line, splitChar, songEnd) : line,
  );
}

function lineHasInlineParens(line: LyricLine, splitChar: string): boolean {
  return classifyLine(lineText(line, splitChar)).kind === "inline";
}

// -- Exports ------------------------------------------------------------------

export type { ExtractOptions };
export {
  classifyLine,
  extractBackgroundVocals,
  extractInlineFromLine,
  extractInlineOnLine,
  lineHasInlineParens,
  scanParenGroups,
};
