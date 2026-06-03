import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { generateForLine } from "@/utils/romanization/generate-for-line";
import { ROMANIZATION_LOG_PREFIX } from "@/utils/romanization/log-prefix";
import { toastRomanizationError } from "@/utils/romanization/toast";
import { useCallback, useState } from "react";

// -- Types --------------------------------------------------------------------

interface UseRegenerateRomanizationResult {
  isBusy: (lineId: string) => boolean;
  regenerate: (line: LyricLine) => Promise<void>;
}

// -- Hook ---------------------------------------------------------------------

function useRegenerateRomanization(scheme: string | undefined): UseRegenerateRomanizationResult {
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());

  const isBusy = useCallback((lineId: string) => busyIds.has(lineId), [busyIds]);

  const regenerate = useCallback(
    async (line: LyricLine) => {
      if (!scheme) return;
      const lineId = line.id;
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.add(lineId);
        return next;
      });
      try {
        const target = useProjectStore.getState().lines.find((l) => l.id === lineId) ?? line;
        const data = await generateForLine(target, scheme);
        useProjectStore.getState().setLineRomanizationWithHistory(lineId, data);
      } catch (err) {
        console.error(`${ROMANIZATION_LOG_PREFIX} Regenerate failed`, err);
        toastRomanizationError("line", err);
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(lineId);
          return next;
        });
      }
    },
    [scheme],
  );

  return { isBusy, regenerate };
}

// -- Exports ------------------------------------------------------------------

export { useRegenerateRomanization };
export type { UseRegenerateRomanizationResult };
