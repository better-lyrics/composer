import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

// Identifies the set of sibling lines linked across instances of a group:
// the same logical line (templateLineIdx) within one group.
interface LinkScope {
  groupId: string;
  templateLineIdx: number;
}

// -- Scope resolution ---------------------------------------------------------

function getLinkScope(line: LyricLine): LinkScope | null {
  if (line.groupId === undefined || line.templateLineIdx === undefined || line.detached) return null;
  return { groupId: line.groupId, templateLineIdx: line.templateLineIdx };
}

function isLinkedSibling(line: LyricLine, scope: LinkScope | null): boolean {
  if (!scope) return false;
  return line.groupId === scope.groupId && line.templateLineIdx === scope.templateLineIdx && !line.detached;
}

// -- Unlinking ----------------------------------------------------------------

function unlinkLines(lines: LyricLine[], shouldUnlink: (line: LyricLine) => boolean): LyricLine[] {
  if (!lines.some(shouldUnlink)) return lines;
  return lines.map((line) =>
    shouldUnlink(line)
      ? { ...line, groupId: undefined, instanceIdx: undefined, templateLineIdx: undefined, detached: undefined }
      : line,
  );
}

// -- Exports ------------------------------------------------------------------

export { getLinkScope, isLinkedSibling, unlinkLines };
