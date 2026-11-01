import type { NoticeKind, NoticeKindId, NoticeRow } from "@/ui/notices/notice-model";
import { useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

interface PendingUndo {
  kindId: NoticeKindId;
  index: number;
  label: string;
  fingerprints: readonly string[];
  restore: (fingerprints: readonly string[]) => void;
}

// -- Constants ----------------------------------------------------------------

const UNDO_WINDOW_MS = 5000;

// -- Hook ---------------------------------------------------------------------

function useNoticeUndo(allKinds: readonly NoticeKind[]) {
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  useEffect(() => {
    if (!pendingUndo) return;
    const timer = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [pendingUndo]);

  const dismiss = (kind: NoticeKind, fingerprints: readonly string[], index: number, label: string) => {
    if (!kind.dismiss || !kind.restore) return;
    kind.dismiss(fingerprints);
    setPendingUndo({ kindId: kind.id, index, label, fingerprints, restore: kind.restore });
  };

  return {
    pendingUndo,
    dismissedCount: allKinds.reduce((sum, kind) => sum + kind.dismissedFingerprints.length, 0),
    dismissRow: (kind: NoticeKind, row: NoticeRow) =>
      dismiss(kind, row.fingerprints, kind.rows.indexOf(row), row.dismissedLabel),
    dismissAll: (kind: NoticeKind) =>
      dismiss(
        kind,
        kind.rows.flatMap((row) => row.fingerprints),
        0,
        kind.rows.length === 1 ? kind.rows[0].dismissedLabel : kind.summary,
      ),
    undo: () => {
      pendingUndo?.restore(pendingUndo.fingerprints);
      setPendingUndo(null);
    },
    showDismissed: () => {
      for (const kind of allKinds) kind.restore?.(kind.dismissedFingerprints);
      setPendingUndo(null);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export type { PendingUndo };
export { useNoticeUndo };
