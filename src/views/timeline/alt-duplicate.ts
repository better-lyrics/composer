import type { LyricLine } from "@/domain/line/model";
import { duplicateWords } from "@/domain/commands/word-moves";
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

function handleAltDuplicate(event: DragEndEvent, lines: readonly LyricLine[], zoom: number, duration: number) {
  const { active, delta } = event;
  const activeData = active.data.current as DragData | undefined;
  if (!activeData) return;
  if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;

  const { selectedWords } = useTimelineStore.getState();
  const wordsToDuplicate = expandSelectionsAcrossLines(lines, resolveWordsToOperate(lines, activeData, selectedWords));

  const words = resolvedWords(lines, wordsToDuplicate);
  if (words.length === 0) return;
  let rejectedLineSynced = false;
  const command = duplicateWords(
    { addresses: words.map(toAddress), timeDelta: delta.x / zoom, duration },
    (plan) => (rejectedLineSynced = plan.rejectedLineSynced),
  );
  useProjectStore.getState().commit(command);
  if (rejectedLineSynced) toast.error(LINE_SYNCED_REJECT_MESSAGE);
}

// -- Exports -------------------------------------------------------------------

export { handleAltDuplicate };
