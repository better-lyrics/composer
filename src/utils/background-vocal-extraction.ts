import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { isLinked } from "@/domain/instance/predicates";
import { withBackground, withSeededBackground } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { wordContentSpans } from "@/domain/line/reconstruct-text";
import { backgroundText, lineText, syllablesText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords } from "@/domain/line/track";
import { withMainTrack, withTrackSyllables, withTrackText } from "@/domain/line/track-writes";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { joinBackgroundText } from "@/utils/background-vocal-brackets";
import { mergeStandaloneInto } from "@/utils/background-vocal-standalone-merge";
import { getSplitCharacter } from "@/utils/split-character";

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

function extractInlineWordSynced(line: LyricLine, classified: LineClassification, options: ExtractOptions): LyricLine {
  const words = roleWords(line, "main");
  if (!words || words.length === 0) return line;
  if (roleWords(line, "bg")) return line;
  const splitChar = getSplitCharacter();
  if (syllablesText(words, splitChar) !== lineText(line)) return line;
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
    i === survivors.length - 1 ? wordFromSpaced({ ...word, text: (word.text + word.sep).replace(/ +$/, "") }) : word,
  );
  const base = backgroundTrack(line)?.source === "extraction" ? undefined : backgroundText(line);
  const joined = joinBackgroundText(base, classified.bgText, options.preserveBrackets, false);
  return withBackground(withMainTrack(line, withTrackSyllables(mainTrack(line), trimmedSurvivors)), {
    text: joined,
    words: base ? undefined : remapWordTextsPreservingTiming(bracketed, joined),
    source: base ? "manual" : "extraction",
  });
}

function extractInline(line: LyricLine, options: ExtractOptions): LyricLine {
  const classified = classifyLine(lineText(line));
  if (classified.kind !== "inline") return line;
  if (isWordSynced(line)) return extractInlineWordSynced(line, classified, options);
  if (roleWords(line, "bg")) return line;
  const base = backgroundTrack(line)?.source === "extraction" ? undefined : backgroundText(line);
  return withBackground(withMainTrack(line, withTrackText(mainTrack(line), classified.mainText)), {
    text: joinBackgroundText(base, classified.bgText, options.preserveBrackets, false),
    source: base ? "manual" : "extraction",
  });
}

function extractInlineFromLine(line: LyricLine, options: ExtractOptions): LyricLine {
  const extracted = extractInline(line, options);
  return extracted === line ? line : withSeededBackground(extracted);
}

function extractInlineAcrossLinkedLines(lines: LyricLine[], lineId: string, options: ExtractOptions): LineUpdate[] {
  const target = lines.find((line) => line.id === lineId);
  if (!target) return [];
  const scope = getLinkScope(target);
  const updates: LineUpdate[] = [];
  for (const line of lines) {
    if (line.id !== lineId && !isLinkedSibling(line, scope)) continue;
    const extracted = extractInlineFromLine(line, options);
    if (extracted === line) return [];
    updates.push({ id: line.id, updates: { tracks: extracted.tracks } });
  }
  return updates;
}

// -- Whole-list transform -----------------------------------------------------

function extractBackgroundVocals(lines: LyricLine[], options: ExtractOptions): LyricLine[] {
  const result: LyricLine[] = [];
  const sameSessionWriteIndices = new Set<number>();
  for (const line of lines) {
    const classified = classifyLine(lineText(line));
    if (classified.kind === "inline") {
      const extracted = extractInline(line, options);
      result.push(extracted);
      if (extracted !== line) sameSessionWriteIndices.add(result.length - 1);
      continue;
    }
    if (classified.kind === "standalone" && options.mergeStandaloneLines) {
      const prevIndex = result.length - 1;
      const prev = result[prevIndex];
      if (
        prev &&
        lineText(prev).trim().length > 0 &&
        classifyLine(lineText(prev)).kind === "none" &&
        !isLinked(prev) &&
        !isLinked(line)
      ) {
        const merged = mergeStandaloneInto(
          prev,
          line,
          classified.bgText,
          sameSessionWriteIndices.has(prevIndex),
          options.preserveBrackets,
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
  return result.map((line, index) => (sameSessionWriteIndices.has(index) ? withSeededBackground(line) : line));
}

function lineHasInlineParens(line: LyricLine): boolean {
  return classifyLine(lineText(line)).kind === "inline";
}

// -- Exports ------------------------------------------------------------------

export type { ExtractOptions };
export {
  classifyLine,
  extractBackgroundVocals,
  extractInlineAcrossLinkedLines,
  extractInlineFromLine,
  lineHasInlineParens,
  scanParenGroups,
};
