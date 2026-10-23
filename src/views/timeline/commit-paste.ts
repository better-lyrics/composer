import { withNewInstance } from "@/domain/group/own-timing";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LineTemplate } from "@/domain/group/template";
import { pickedTemplateSource, templateSourceInstance } from "@/domain/group/template-source";
import { instanceCount } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { applyPasteToLines, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import { decidePasteInstanceAction } from "@/views/timeline/decide-paste-instance-action";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { findMatchingTemplate } from "@/views/timeline/structural-match";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

type PasteOutcome = "pasted" | "overlap" | "no-line" | "cancelled" | "no-change";

interface PasteTarget {
  clipboard: ClipboardData;
  cursorTime: number;
  lineIndex: number;
}

// -- Helpers -------------------------------------------------------------------

function finishPaste(): void {
  useTimelineStore.getState().setPasteMode({ status: "idle" });
  useTimelineStore.getState().clearSelection();
}

async function placeInstance(
  lines: LyricLine[],
  target: PasteTarget,
  groupId: string,
  template: LineTemplate[],
  successMessage: string,
): Promise<PasteOutcome> {
  if (template.length === 0) {
    toast.error("Could not derive instance template");
    return "no-change";
  }
  const decision = decidePasteInstanceAction({
    lines,
    groupId,
    template,
    hoveredLineIndex: target.lineIndex,
    cursorTime: target.cursorTime,
  });
  if (decision.kind === "no-target") {
    toast.error(`Drop on ${pluralize(template.length, "empty line")} to paste this instance`);
    return "no-line";
  }
  if (decision.kind === "fill") {
    const { groups, setLinesWithHistory } = useProjectStore.getState();
    setLinesWithHistory(decision.updatedLines, withNewInstance(groups, groupId, decision.instanceIdx));
    finishPaste();
    toast.success(successMessage);
    return "pasted";
  }
  const ok = await useConfirmStore.getState().open({
    title: `Insert ${pluralize(template.length, "new row")} here?`,
    description: `There ${template.length === 1 ? "isn't an empty row" : `aren't ${template.length} empty rows`} at this position. Inserting will shift every row below down by ${template.length}.`,
    confirmLabel: "Insert and paste",
    cancelLabel: "Cancel",
    variant: "destructive",
  });
  if (!ok) {
    useTimelineStore.getState().setPasteMode({ status: "idle" });
    return "cancelled";
  }
  useProjectStore.getState().addInstance(groupId, template, decision.instanceStart, decision.insertAt);
  finishPaste();
  toast.success(successMessage);
  return "pasted";
}

// -- Commit --------------------------------------------------------------------

async function commitPasteAt(target: PasteTarget): Promise<PasteOutcome> {
  const { clipboard, cursorTime, lineIndex } = target;
  const lines = useProjectStore.getState().lines;

  if (clipboard.sourceInstance) {
    const { groupId, instanceIdx } = clipboard.sourceInstance;
    const group = useProjectStore.getState().groups.find((candidate) => candidate.id === groupId);
    const template = instanceToTemplate(lines, groupId, pickedTemplateSource(lines, group, instanceIdx));
    return placeInstance(lines, target, groupId, template, "Linked instance added");
  }

  if (clipboard.candidateLines && clipboard.candidateLines.length > 0) {
    const match = findMatchingTemplate(clipboard.candidateLines, lines);
    if (match) {
      const group = useProjectStore.getState().groups.find((g) => g.id === match.groupId);
      const groupLabel = group?.label ?? "group";
      const matchedInstances = instanceCount(lines, match.groupId);
      const ok = await useConfirmStore.getState().open({
        title: `Link as another ${groupLabel}?`,
        description: `These ${clipboard.candidateLines.length} lines look like a ${groupLabel} (matches ${pluralize(matchedInstances, "instance")}). Link as another instance, or paste as plain words?`,
        confirmLabel: "Link as instance",
        cancelLabel: "Paste as words",
      });
      if (ok) {
        const sourceIdx = templateSourceInstance(lines, group, match.instanceIdx);
        const template = instanceToTemplate(lines, match.groupId, sourceIdx);
        return placeInstance(lines, target, match.groupId, template, `Linked as another ${groupLabel}`);
      }
    }
  }

  if (lineIndex < 0) return "no-line";

  const timeDelta = cursorTime - clipboard.entries[0].word.begin;
  const rangeOf = timeRangeResolver(lines, useProjectStore.getState().groups, useAudioStore.getState().duration);
  if (pasteOverlaps(clipboard, lineIndex, timeDelta, lines, rangeOf)) return "overlap";

  const updates = applyPasteToLines({ lines, clipboard, targetLineIndex: lineIndex, timeDelta, rangeOf });
  if (!updates || updates.length === 0) return "no-change";

  useProjectStore.getState().updateLinesWithHistory(updates);
  finishPaste();
  return "pasted";
}

// -- Exports -------------------------------------------------------------------

export { commitPasteAt };
