import { duplicateWords, planDuplicate } from "@/domain/commands/word-moves";
import type { TimeRange } from "@/domain/group/shared-timing";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { toAddress } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import {
  DRAG_X_MIN_THRESHOLD,
  type DragData,
  LINE_SYNCED_REJECT_MESSAGE,
  expandSelectionsAcrossLines,
  resolvedWords,
  resolveWordsToOperate,
} from "@/views/timeline/drag-handlers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";

// -- Alt duplicate -------------------------------------------------------------

function handleAltDuplicate(
  event: DragEndEvent,
  lines: readonly ReadableLine[],
  zoom: number,
  rangeOf: (line: LyricLine) => TimeRange,
  duration: number,
) {
  const { active, delta } = event;
  const activeData = active.data.current as DragData | undefined;
  if (!activeData) return;
  if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

  const { selectedWords } = useTimelineStore.getState();
  const wordsToDuplicate = expandSelectionsAcrossLines(lines, resolveWordsToOperate(lines, activeData, selectedWords));

  const timeDelta = delta.x / zoom;
  const words = resolvedWords(lines, wordsToDuplicate);
  const plan = planDuplicate(lines, words, timeDelta, rangeOf);
  if (plan.rejectedLineSynced) toast.error(LINE_SYNCED_REJECT_MESSAGE);
  if (plan.updates.length === 0) return;
  useProjectStore.getState().commit(duplicateWords({ addresses: words.map(toAddress), timeDelta, duration }));
}

// -- Exports -------------------------------------------------------------------

export { handleAltDuplicate };
