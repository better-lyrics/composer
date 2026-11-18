import { isLinked, isSlotLine } from "./instance-predicates";
import { keepsBackgroundTiming, withBackground, withSeededBackground } from "./line-background";
import { withTimedBackgroundJoined } from "./background-vocal-timed-join";
import type { LineUpdate, LyricLine } from "./line";
import { bgBounds } from "./line-bounds";
import { isWordSynced } from "./line-predicates";
import { backgroundText, lineText } from "./line-text";
import { backgroundTrack, mainTrack } from "./line-track";
import { withMainTrack, withTrackText } from "./line-track-writes";
import { type BracketJoin, joinBackgroundText } from "./background-vocal-brackets";
import { gluedGroups } from "./background-vocal-glued-groups";
import { mergeStandaloneInto } from "./background-vocal-standalone-merge";
import { withOnePairBackground } from "./background-vocal-one-pair";
import { extractInlineWordSynced, groupsText } from "./background-vocal-word-synced";

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

interface ExtractOptions extends BracketJoin {
  mergeStandaloneLines: boolean;
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

function classifyGroups(text: string, groups: ParenGroup[]): LineClassification {
  if (groups.length === 0) return { kind: "none", groups: [], bgText: "", mainText: text };
  const bgText = groupsText(groups, "space");
  if (bgText.length === 0) return { kind: "none", groups, bgText: "", mainText: text };
  const mainText = collapseSpaces(stripGroups(text, groups));
  return { kind: mainText.length === 0 ? "standalone" : "inline", groups, bgText, mainText };
}

function classifyLine(text: string): LineClassification {
  const scan = scanParenGroups(text);
  if (scan.status !== "balanced") return { kind: "skip", groups: [], bgText: "", mainText: text };
  return classifyGroups(text, scan.groups);
}

// -- Extraction ---------------------------------------------------------------

// A background timed by hand keeps typed brackets beside it as text; a seeded one is seeded again with them, as a paste.
function backgroundRefuses(line: LyricLine, classified: LineClassification): boolean {
  return classified.kind === "inline" && bgBounds(line) !== null && backgroundTrack(line)?.source !== "extraction";
}

// `keptGroups` are group indices that stay text, as every linked copy keeps the groups any one of them keeps.
function extractInline(
  line: LyricLine,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
  keptGroups?: ReadonlySet<number>,
): LyricLine {
  const text = lineText(line, splitChar);
  const scanned = classifyLine(text);
  const extractable = keptGroups && scanned.groups.filter((_, index) => !keptGroups.has(index));
  const classified = extractable ? classifyGroups(text, extractable) : scanned;
  if (classified.kind !== "inline" || backgroundRefuses(line, classified)) return line;
  if (isWordSynced(line)) return extractInlineWordSynced(line, classified, options, splitChar, songEnd);
  const base = backgroundText(line, splitChar);
  const fromExtraction = backgroundTrack(line)?.source === "extraction";
  const withMain = withMainTrack(line, withTrackText(mainTrack(line), classified.mainText, splitChar));
  const joined = joinBackgroundText(base, groupsText(classified.groups, options.separator), options);
  if (keepsBackgroundTiming(line, splitChar, songEnd))
    return withTimedBackgroundJoined(withMain, joined, options, splitChar);
  return withBackground(
    withMain,
    { text: joined, source: base && !fromExtraction ? "manual" : "extraction" },
    splitChar,
  );
}

function extractInlineFromLine(
  line: LyricLine,
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine {
  const extracted = extractInline(line, options, splitChar, songEnd);
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

// -- Linked instances ---------------------------------------------------------

// Linked instances of one template line show one text, so extraction changes all of them or none.
function extractionSlot(line: LyricLine): string | null {
  return isSlotLine(line) ? `${line.groupId}\u0000${line.templateLineIdx}` : null;
}

// A linked line with inline brackets that extraction leaves as it is keeps every instance of its template line.
function refusesExtraction(line: LyricLine, options: ExtractOptions, splitChar: string): boolean {
  return (
    extractionSlot(line) !== null &&
    classifyLine(lineText(line, splitChar)).kind === "inline" &&
    extractInline(line, options, splitChar) === line
  );
}

function keepsTypedBackgroundGroups(line: LyricLine, splitChar: string): boolean {
  return bgBounds(line) !== null && backgroundRefuses(line, classifyLine(lineText(line, splitChar)));
}

// Group indices a timed copy keeps as text because one of its words reaches into them, by slot.
function slotKeptGroups(lines: readonly LyricLine[], splitChar: string): Map<string, Set<number>> {
  const kept = new Map<string, Set<number>>();
  for (const line of lines) {
    const slot = extractionSlot(line);
    if (slot === null || !isWordSynced(line)) continue;
    const { groups } = classifyLine(lineText(line, splitChar));
    const glued = gluedGroups(line, groups, splitChar);
    if (glued.size === 0) continue;
    const slotKept = kept.get(slot) ?? new Set<number>();
    for (const [index, group] of groups.entries()) if (glued.has(group)) slotKept.add(index);
    kept.set(slot, slotKept);
  }
  return kept;
}

// -- Whole-list transform -----------------------------------------------------

// Brackets in the lyrics move to the background; backgrounds stay as they were typed.
function extractBracketGroups(
  lines: LyricLine[],
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine[] {
  const result: LyricLine[] = [];
  const sameSessionWriteIndices = new Set<number>();
  const slotLines = new Map<number, LyricLine>();
  const refusedSlots = new Set<string>();
  const keptBySlot = slotKeptGroups(lines, splitChar);
  for (const line of lines) {
    const classified = classifyLine(lineText(line, splitChar));
    if (classified.kind === "inline") {
      const slot = extractionSlot(line);
      const extracted = extractInline(line, options, splitChar, songEnd, keptBySlot.get(slot ?? ""));
      result.push(extracted);
      if (extracted !== line) sameSessionWriteIndices.add(result.length - 1);
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
          groupsText(classified.groups, options.separator),
          sameSessionWriteIndices.has(prevIndex),
          options,
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
    if (!refusedSlots.has(extractionSlot(line) ?? "")) continue;
    result[index] = line;
    sameSessionWriteIndices.delete(index);
  }
  return result.map((line, index) =>
    sameSessionWriteIndices.has(index) ? withSeededBackground(line, splitChar, songEnd) : line,
  );
}

// Brackets move to the background, and every background becomes one pair.
function extractBackgroundVocals(
  lines: LyricLine[],
  options: ExtractOptions,
  splitChar: string,
  songEnd = Number.POSITIVE_INFINITY,
): LyricLine[] {
  return extractBracketGroups(lines, options, splitChar, songEnd).map((line) =>
    withOnePairBackground(line, options, splitChar),
  );
}

function lineHasInlineParens(line: LyricLine, splitChar: string): boolean {
  return classifyLine(lineText(line, splitChar)).kind === "inline";
}

// -- Exports ------------------------------------------------------------------

export type { ExtractOptions, LineClassification, ParenGroup };
export {
  classifyLine,
  extractBackgroundVocals,
  extractBracketGroups,
  extractInlineFromLine,
  extractInlineOnLine,
  extractionSlot,
  keepsTypedBackgroundGroups,
  lineHasInlineParens,
  refusesExtraction,
  scanParenGroups,
};
