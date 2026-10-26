import { isLinked } from "@/domain/instance/predicates";
import { isSectionTagLine } from "@/domain/lyrics-file/genius-text";
import { useProjectStore } from "@/stores/project";
import type { NoticeAction, NoticeKind } from "@/ui/notices/notice-model";
import { pluralWord, pluralize } from "@/utils/pluralize";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Helpers ------------------------------------------------------------------

function isRemovableSectionTag(line: ParsedLine): boolean {
  return line.lineId !== "" && line.groupId === undefined && isSectionTagLine(line.text);
}

function removeSectionTagLines(lineIds: ReadonlySet<string>): void {
  const { lines, setLinesWithHistory } = useProjectStore.getState();
  const kept = lines.filter((line) => !(lineIds.has(line.id) && isSectionTagLine(line.text) && !isLinked(line)));
  if (kept.length !== lines.length) setLinesWithHistory(kept);
}

function removeAction(label: string, lineIds: readonly string[]): NoticeAction {
  return { label, icon: IconTrash, run: () => removeSectionTagLines(new Set(lineIds)) };
}

// -- Hook ---------------------------------------------------------------------

function useBracketNotice(parsed: readonly ParsedLine[]): NoticeKind | null {
  return useMemo(() => {
    const bracketLines = parsed.filter((line) => line.hasBrackets);
    if (bracketLines.length === 0) return null;
    const removableIds = bracketLines.filter(isRemovableSectionTag).map((line) => line.lineId);
    return {
      id: "brackets",
      icon: IconAlertTriangle,
      tone: "warn",
      summary: `${pluralize(bracketLines.length, "line")} ${pluralWord(bracketLines.length, "contains", "contain")} [brackets]`,
      rows: bracketLines.map((line) => {
        const removable = isRemovableSectionTag(line);
        return {
          key: line.lineId,
          fingerprints: [],
          title: `Line ${line.lineNumber} · ${line.text.trim()}`,
          detail: removable
            ? "Section tags are not sung. Remove them before syncing."
            : "Brackets are kept as text. Remove them, or keep them on purpose.",
          accept: removable ? removeAction("Remove", [line.lineId]) : undefined,
          dismissedLabel: `Line ${line.lineNumber}`,
        };
      }),
      acceptAll: removableIds.length > 0 ? removeAction("Remove section tags", removableIds) : undefined,
      dismissedFingerprints: [],
      modalTitle: "Lines with brackets",
    };
  }, [parsed]);
}

// -- Exports ------------------------------------------------------------------

export { useBracketNotice };
