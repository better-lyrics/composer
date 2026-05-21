import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";

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

function extractInlineFromLine(line: LyricLine): LyricLine {
  const classified = classifyLine(line.text);
  if (classified.kind !== "inline") return line;
  if (isWordSynced(line)) return line;
  return {
    ...line,
    text: classified.mainText,
    backgroundText: joinBackgroundText(line.backgroundText, classified.bgText),
  };
}

// -- Exports ------------------------------------------------------------------

export { classifyLine, extractInlineFromLine, scanParenGroups };
export type { LineClassification, LineClassKind, ParenGroup, ParenScan, ParenScanStatus };
