import type { NoticeKind } from "@/ui/notices/notice-model";
import { pluralWord, pluralize } from "@/utils/pluralize";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

function useBracketNotice(parsed: readonly ParsedLine[]): NoticeKind | null {
  return useMemo(() => {
    const bracketLines = parsed.filter((line) => line.hasBrackets);
    if (bracketLines.length === 0) return null;
    return {
      id: "brackets",
      icon: IconAlertTriangle,
      tone: "warn",
      summary: `${pluralize(bracketLines.length, "line")} ${pluralWord(bracketLines.length, "contains", "contain")} [brackets]`,
      rows: bracketLines.map((line) => ({
        key: line.lineId,
        fingerprints: [],
        title: `Line ${line.lineNumber} · ${line.text.trim()}`,
        detail: "Brackets are kept as text. Remove them, or keep them on purpose.",
        dismissedLabel: `Line ${line.lineNumber}`,
      })),
      dismissedFingerprints: [],
      modalTitle: "Lines with brackets",
    };
  }, [parsed]);
}

// -- Exports ------------------------------------------------------------------

export { useBracketNotice };
