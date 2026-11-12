import { effectiveBounds } from "@/domain/line/bounds";
import type { ReadableLine } from "@/domain/line/effective-words";
import { lineWordSelections } from "@/domain/selection/line-selections";
import { useIsActiveTab } from "@/hooks/use-is-active-tab";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { centreLineRow } from "@/views/timeline/centre-line-row";
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

function settle(request: LineRevealRequest): void {
  if (pendingRequest === request) publish(null);
}

// -- Functions -----------------------------------------------------------------

function revealLineInTimeline(lineId: string, track: LineRevealRequest["track"]): void {
  useProjectStore.getState().setActiveTab("timeline");
  publish({ lineId, track });
}

function revealLine(container: HTMLElement, lines: ReadableLine[], request: LineRevealRequest): void {
  const lineIndex = lines.findIndex((line) => line.id === request.lineId);
  const line = lines[lineIndex];
  if (!line) return;

  centreLineRow(container, lines, line);
  const bounds = effectiveBounds(line);
  if (bounds) useAudioStore.getState().seekTo(bounds.begin, "centre");
  if (request.track) {
    const track = request.track;
    useTimelineStore
      .getState()
      .setSelectedWords(lineWordSelections(line, lineIndex).filter((selection) => selection.type === track));
  }
}

// -- Hook ----------------------------------------------------------------------

function useLineRevealRequest(scrollContainerRef: RefObject<HTMLDivElement | null>, lines: ReadableLine[]): void {
  const request = useSyncExternalStore(subscribe, snapshot, snapshot);
  const timelineActive = useIsActiveTab("timeline");

  useEffect(() => {
    if (!request || !timelineActive) return;
    const frame = nextFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      revealLine(container, lines, request);
      settle(request);
    });
    return () => cancelNextFrame(frame);
  }, [request, timelineActive, lines, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { revealLineInTimeline, useLineRevealRequest };
