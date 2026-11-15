import type { LyricLine } from "@/domain/line/model";
import { lineInstanceKey } from "@/domain/instance/key";
import { effectiveBounds } from "@/domain/line/bounds";
import { lineWordSelections } from "@/domain/selection/line-selections";
import { useIsActiveTab } from "@/hooks/use-is-active-tab";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { centreLineRow } from "@/views/timeline/centre-line-row";
import { type GroupFocus, isInFocus } from "@/views/timeline/group-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect, useSyncExternalStore } from "react";

// -- Types ---------------------------------------------------------------------

interface LineRevealRequest {
  lineId: string;
  track: "word" | "bg" | null;
}

// -- State ---------------------------------------------------------------------

// Module state so a request survives until the Timeline panel mounts on its first visit.
let pendingRequest: LineRevealRequest | null = null;
const listeners = new Set<() => void>();

function publish(request: LineRevealRequest | null): void {
  pendingRequest = request;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): LineRevealRequest | null {
  return pendingRequest;
}

function hasPendingLineReveal(): boolean {
  return pendingRequest !== null;
}

function settle(request: LineRevealRequest): void {
  if (pendingRequest === request) publish(null);
}

// -- Functions -----------------------------------------------------------------

function revealLineInTimeline(lineId: string, track: LineRevealRequest["track"]): void {
  useProjectStore.getState().setActiveTab("timeline");
  publish({ lineId, track });
}

// Returns false when a group focus or a collapsed instance hid the row: it exists only after the next render.
function revealLine(
  container: HTMLElement,
  lines: LyricLine[],
  request: LineRevealRequest,
  focusedGroup: GroupFocus | null,
  collapsedInstances: Record<string, boolean>,
): boolean {
  const line = lines.find((candidate) => candidate.id === request.lineId);
  if (!line) return true;
  if (!isInFocus(line, focusedGroup)) {
    useTimelineStore.getState().closeGroup();
    return false;
  }
  const instance = lineInstanceKey(line);
  if (instance && collapsedInstances[instance]) {
    useTimelineStore.getState().setInstanceCollapsed(instance, false);
    return false;
  }

  centreLineRow(container, lines, line);
  const bounds = effectiveBounds(line);
  if (bounds) useAudioStore.getState().seekTo(bounds.begin, "centre");
  if (request.track) {
    const track = request.track;
    useTimelineStore
      .getState()
      .setSelectedWords(lineWordSelections(line).filter((selection) => selection.type === track));
  }
  return true;
}

// -- Hook ----------------------------------------------------------------------

function useLineRevealRequest(scrollContainerRef: RefObject<HTMLDivElement | null>, lines: LyricLine[]): void {
  const request = useSyncExternalStore(subscribe, snapshot, snapshot);
  const timelineActive = useIsActiveTab("timeline");
  const focusedGroup = useTimelineStore((state) => state.focusedGroup);
  const collapsedInstances = useTimelineStore((state) => state.collapsedInstances);

  useEffect(() => {
    if (!request || !timelineActive) return;
    const frame = nextFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      if (revealLine(container, lines, request, focusedGroup, collapsedInstances)) settle(request);
    });
    return () => cancelNextFrame(frame);
  }, [request, timelineActive, lines, focusedGroup, collapsedInstances, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { hasPendingLineReveal, revealLineInTimeline, useLineRevealRequest };
