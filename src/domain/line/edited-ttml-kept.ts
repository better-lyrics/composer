import type { Part, PartSection } from "insync/part";
import { partsAfterLineChange } from "insync/part-membership";
import { type DocPassthrough, withRenamedAnchors } from "insync/passthrough";
import { type EditedTtmlLines, mergedLineIds } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "insync/line";

// -- Helpers ------------------------------------------------------------------

function onLineIds<T extends PartSection>(section: T, idOf: ReadonlyMap<string, string>): T {
  return {
    ...section,
    lineIds: section.lineIds.map((id) => idOf.get(id) ?? id),
    ...(section.passthrough && { passthrough: withRenamedAnchors(section.passthrough, idOf) }),
    ...(section.sections && { sections: section.sections.map((nested) => onLineIds(nested, idOf)) }),
  };
}

// The edited file's song parts, on the merged line ids; lines the export skips join a part they sit inside.
function mergedEditedParts(
  edit: EditedTtmlLines,
  merged: readonly LyricLine[],
  idOf: ReadonlyMap<string, string>,
): readonly Part[] {
  const parts = edit.parts ?? [];
  if (parts.length === 0) return parts;
  return partsAfterLineChange(
    parts.map((part) => onLineIds(part, idOf)),
    edit.lines.map((line) => idOf.get(line.id) ?? line.id),
    merged.map((line) => line.id),
  );
}

// -- Functions ----------------------------------------------------------------

// The edited file's song parts and document data, on the merged line ids.
function mergedEditedKept(
  stored: readonly LyricLine[],
  edit: EditedTtmlLines,
  merged: readonly LyricLine[],
  splitChar: string,
): { parts: readonly Part[]; passthrough: DocPassthrough } {
  const idOf = mergedLineIds(stored, edit, splitChar);
  const passthrough = edit.passthrough ?? {};
  return {
    parts: mergedEditedParts(edit, merged, idOf),
    passthrough: passthrough.body ? { ...passthrough, body: withRenamedAnchors(passthrough.body, idOf) } : passthrough,
  };
}

// -- Exports ------------------------------------------------------------------

export { mergedEditedKept };
