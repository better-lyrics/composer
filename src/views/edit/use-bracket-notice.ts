import type { BackgroundBracketRefusal } from "insync/background-vocal-refusals";
import { removeSectionTagLines } from "insync/commands/edit-text";
import { isSectionTagLine } from "insync/lyrics-file-genius-text";
import { useProjectStore } from "@/stores/project";
import type { NoticeAction, NoticeKind } from "@/ui/notices/notice-model";
import { pluralWord, pluralize } from "insync/pluralize";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Constants ----------------------------------------------------------------

const BACKGROUND_REFUSAL_DETAIL: Record<BackgroundBracketRefusal, string> = {
  own: "This line already has background vocals. Type inside their brackets to add to them.",
  linked: "A linked copy of this line already has background vocals. Type inside their brackets to add to them.",
};

// -- Helpers ------------------------------------------------------------------

function isRemovableSectionTag(line: ParsedLine): boolean {
  return line.lineId !== "" && line.groupId === undefined && isSectionTagLine(line.text);
}

function removeAction(label: string, lineIds: readonly string[]): NoticeAction {
  return {
    label,
    icon: IconTrash,
    run: () => useProjectStore.getState().commit(removeSectionTagLines(new Set(lineIds))),
  };
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

// Brackets typed beside a timed background stay as text: extraction would make a second background group.
function useBackgroundBracketNotice(parsed: readonly ParsedLine[]): NoticeKind | null {
  return useMemo(() => {
    const keptLines = parsed.filter((line) => line.backgroundBracketRefusal);
    if (keptLines.length === 0) return null;
    return {
      id: "background-brackets",
      icon: IconAlertTriangle,
      tone: "warn",
      summary: `${pluralize(keptLines.length, "line")} ${pluralWord(keptLines.length, "keeps", "keep")} (brackets) as text`,
      rows: keptLines.map((line) => ({
        key: line.lineId,
        fingerprints: [],
        title: `Line ${line.lineNumber} · ${line.text.trim()}`,
        detail: BACKGROUND_REFUSAL_DETAIL[line.backgroundBracketRefusal ?? "own"],
        dismissedLabel: `Line ${line.lineNumber}`,
      })),
      dismissedFingerprints: [],
      modalTitle: "Brackets beside background vocals",
    };
  }, [parsed]);
}

// -- Exports ------------------------------------------------------------------

export { useBackgroundBracketNotice, useBracketNotice };
