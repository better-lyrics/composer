import { withNewInstance } from "@/domain/group/own-timing";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LineTemplate } from "@/domain/group/template";
import { templateSourceInstance } from "@/domain/group/template-source";
import { nextInstanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAudioStore } from "@/stores/audio";
import { askChoice, FINISH_OPEN_PROMPT_FIRST } from "@/stores/choice-store";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { toast } from "@/utils/toast";
import { showUndoToast } from "@/utils/undo-toast";
import { applyPasteToLines, clipboardInLane, pasteOverlaps } from "@/views/timeline/apply-paste-to-lines";
import { decidePasteInstanceAction } from "@/views/timeline/decide-paste-instance-action";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import { instancePasteTemplate } from "@/views/timeline/instance-paste-template";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { findMatchingTemplate } from "@/views/timeline/structural-match";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

type PasteOutcome = "pasted" | "overlap" | "no-line" | "no-change";

interface PasteTarget {
  clipboard: ClipboardData;
  cursorTime: number;
  lineIndex: number;
  lane: WordTrack;
}

// -- Helpers -------------------------------------------------------------------

function finishPaste(): void {
  useTimelineStore.getState().setPasteMode({ status: "idle" });
  useTimelineStore.getState().clearSelection();
  noteGuideSignal("timeline.copy");
}

function placeInstance(
  lines: LyricLine[],
  target: PasteTarget,
  groupId: string,
  template: LineTemplate[],
  successMessage: string,
): PasteOutcome {
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
  useProjectStore.getState().addInstance(groupId, template, decision.instanceStart, decision.insertAt);
  finishPaste();
  showUndoToast(`Inserted ${pluralize(template.length, "row")}`);
  return "pasted";
}

// -- Commit --------------------------------------------------------------------

async function commitPasteAt(target: PasteTarget): Promise<PasteOutcome> {
  const { clipboard, cursorTime, lineIndex } = target;
  const lines = useProjectStore.getState().lines;

  if (clipboard.sourceInstance) {
    const template = instancePasteTemplate(lines, useProjectStore.getState().groups, clipboard.sourceInstance);
    return placeInstance(lines, target, clipboard.sourceInstance.groupId, template, "Linked instance added");
  }

  if (clipboard.candidateLines && clipboard.candidateLines.length > 0) {
    const match = findMatchingTemplate(clipboard.candidateLines, lines);
    const group = match && useProjectStore.getState().groups.find((g) => g.id === match.groupId);
    if (match && group) {
      const answer = await askChoice({
        title: `These lines match ${group.label}`,
        body: `Link them to share ${group.label} timing, or paste them as their own words.`,
        busyMessage: FINISH_OPEN_PROMPT_FIRST,
        options: [
          { value: "words", label: "Paste as words", variant: "secondary" },
          { value: "link", label: `Link as ${nextInstanceName(lines, group)}`, variant: "primary" },
        ],
      });
      if (answer === "cancel") return "no-change";
      if (answer === "link") {
        const sourceIdx = templateSourceInstance(lines, group, match.instanceIdx);
        const template = instanceToTemplate(lines, match.groupId, sourceIdx);
        return placeInstance(lines, target, match.groupId, template, `Linked as another ${group.label}`);
      }
    }
  }

  if (lineIndex < 0) return "no-line";

  const wordsInLane = clipboardInLane(clipboard, target.lane);
  const timeDelta = cursorTime - clipboard.entries[0].word.begin;
  const rangeOf = timeRangeResolver(lines, useProjectStore.getState().groups, useAudioStore.getState().duration);
  if (pasteOverlaps(wordsInLane, lineIndex, timeDelta, lines, rangeOf)) return "overlap";

  const updates = applyPasteToLines({ lines, clipboard: wordsInLane, targetLineIndex: lineIndex, timeDelta, rangeOf });
  if (!updates || updates.length === 0) return "no-change";

  useProjectStore.getState().updateLinesWithHistory(updates);
  finishPaste();
  return "pasted";
}

// -- Exports -------------------------------------------------------------------

export { commitPasteAt };
