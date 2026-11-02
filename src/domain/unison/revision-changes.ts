import type { RevisionDiffRow } from "@/lib/unison/revision-types";
import { pluralize } from "@/utils/pluralize";

// -- Types ---------------------------------------------------------------------

type DiffLineKind = "same" | "retimed" | "added" | "removed" | "gap";

interface DiffLine {
  kind: DiffLineKind;
  text: string;
  detail?: string;
}

interface RevisionChangeCounts {
  lines: number;
  wordsRetimed: number;
  details: number;
}

// -- Constants -----------------------------------------------------------------

const FIELD_LABELS = { language: "Language", isrc: "ISRC", album: "Album" } as const;
const CHANGED_LINE_KINDS = new Set<RevisionDiffRow["kind"]>(["add", "del", "word", "timing", "syllable"]);

// -- Helpers -------------------------------------------------------------------

function shiftLabel(deltaMs: number): string {
  return `${(Math.abs(deltaMs) / 1000).toFixed(2)} s ${deltaMs > 0 ? "later" : "earlier"}`;
}

function syllableLabel(moved: number): string {
  return moved > 0 ? `${pluralize(moved, "word")} moved` : "Syllables split differently";
}

function textWithout(parts: readonly [string, string][], skipped: "+" | "-"): string {
  return parts
    .filter(([op]) => op !== skipped)
    .map(([, text]) => text)
    .join("");
}

function diffLinesOfRow(row: RevisionDiffRow): DiffLine[] {
  switch (row.kind) {
    case "same":
      return [{ kind: "same", text: row.text }];
    case "add":
      return [{ kind: "added", text: row.text }];
    case "del":
      return [{ kind: "removed", text: row.text }];
    case "word":
      return [
        { kind: "removed", text: textWithout(row.parts, "+") },
        { kind: "added", text: textWithout(row.parts, "-") },
      ];
    case "timing": {
      const detail = [shiftLabel(row.deltaMs), row.syllables && syllableLabel(row.syllables.moved)];
      return [{ kind: "retimed", text: row.text, detail: detail.filter(Boolean).join(", ") }];
    }
    case "syllable":
      return [{ kind: "retimed", text: row.text, detail: syllableLabel(row.moved) }];
    case "gap":
      return [{ kind: "gap", text: `${pluralize(row.count, "line")} unchanged` }];
    case "field": {
      const label = FIELD_LABELS[row.field];
      return [
        ...(row.before === null ? [] : [{ kind: "removed" as const, text: `${label}: ${row.before}` }]),
        ...(row.after === null ? [] : [{ kind: "added" as const, text: `${label}: ${row.after}` }]),
      ];
    }
  }
}

// -- Functions -----------------------------------------------------------------

function revisionDiffLines(rows: readonly RevisionDiffRow[]): DiffLine[] {
  return rows.flatMap(diffLinesOfRow);
}

function revisionChangeCounts(rows: readonly RevisionDiffRow[]): RevisionChangeCounts {
  const counts: RevisionChangeCounts = { lines: 0, wordsRetimed: 0, details: 0 };
  for (const row of rows) {
    if (CHANGED_LINE_KINDS.has(row.kind)) counts.lines++;
    if (row.kind === "field") counts.details++;
    if (row.kind === "syllable") counts.wordsRetimed += row.moved;
    if (row.kind === "timing") counts.wordsRetimed += row.syllables?.moved ?? 0;
  }
  return counts;
}

// -- Exports -------------------------------------------------------------------

export type { DiffLine, DiffLineKind, RevisionChangeCounts };
export { revisionChangeCounts, revisionDiffLines };
