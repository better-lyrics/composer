import { loopRegionBetween } from "@/domain/selection/loop-region";
import { snapPointTimes } from "@/domain/snap-point/model";
import { holdFrames, subscribeFrame } from "@/lib/frame-loop";
import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { computeEdgeScrollVelocity } from "@/views/timeline/edge-scroll";
import { snapPlayheadTime } from "@/views/timeline/playhead-snap";
import { commitDrawnLoopRegion } from "@/views/timeline/selection-playback";
import { holdsSnapBypass } from "@/views/timeline/snap-bypass-key";
import { GUTTER_WIDTH, type LoopRegionDrag, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Constants -----------------------------------------------------------------

const DRAW_THRESHOLD_PX = 5;
const EDGE_SCROLL_ZONE = 60;
const EDGE_SCROLL_MAX_SPEED = 22;
const EDGE_SCROLL_LABEL = "loop-region-edge-scroll";

// -- Functions -----------------------------------------------------------------

function snappedTo(raw: number, snapped: number): LoopRegionDrag["snappedTo"] {
  if (snapped === raw) return null;
  return snapPointTimes(useProjectStore.getState().customSnapPoints).includes(snapped) ? "pin" : "onset";
}

// edge null draws a new region; an edge moves that side of the current one while the other stays put.
function startLoopRegionDrag(
  event: React.MouseEvent<HTMLElement>,
  scrollContainer: HTMLElement,
  edge: LoopRegionDrag["edge"] | null,
): void {
  const duration = useAudioStore.getState().duration;
  if (event.button !== 0 || duration <= 0) return;
  event.stopPropagation();

  const timeAt = (clientX: number): number => {
    const x = clientX - scrollContainer.getBoundingClientRect().left - GUTTER_WIDTH + scrollContainer.scrollLeft;
    return Math.max(0, Math.min(duration, x / useTimelineStore.getState().zoom));
  };
  const region = useTimelineStore.getState().loopRegion;
  if (edge && !region) return;
  const anchor =
    edge && region
      ? edge === "begin"
        ? region.end
        : region.begin
      : snapPlayheadTime(timeAt(event.clientX), holdsSnapBypass(event));
  const startX = event.clientX;
  let pointerX = event.clientX;
  let bypassHeld = holdsSnapBypass(event);
  let moving = false;
  let releaseFrames: (() => void) | null = null;
  let unsubscribeEdgeScroll: (() => void) | null = null;
  const controller = new AbortController();

  const update = (): void => {
    const raw = timeAt(pointerX);
    const time = snapPlayheadTime(raw, bypassHeld);
    const bounds = loopRegionBetween(anchor, time, duration);
    const timeline = useTimelineStore.getState();
    const current = timeline.loopRegion;
    if (edge && bounds && current) timeline.setLoopRegion({ ...bounds, loops: current.loops });
    const draft = edge ? null : bounds;
    timeline.setLoopRegionDrag({ edge: time < anchor ? "begin" : "end", snappedTo: snappedTo(raw, time), draft });
  };

  const tickEdgeScroll = (): void => {
    const rect = scrollContainer.getBoundingClientRect();
    const velocity = computeEdgeScrollVelocity({
      pointerX,
      contentLeft: rect.left + GUTTER_WIDTH,
      contentRight: rect.right,
      edgeSize: EDGE_SCROLL_ZONE,
      maxSpeed: EDGE_SCROLL_MAX_SPEED,
    });
    if (velocity === 0) return;
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    scrollContainer.scrollLeft = Math.max(0, Math.min(maxScroll, scrollContainer.scrollLeft + velocity));
  };

  const startMoving = (): void => {
    moving = true;
    useTimelineStore.getState().setLoopRegionDrag({ edge: edge ?? "end", snappedTo: null, draft: null });
    releaseFrames = holdFrames(EDGE_SCROLL_LABEL);
    unsubscribeEdgeScroll = subscribeFrame(tickEdgeScroll, EDGE_SCROLL_LABEL);
  };

  const handleMove = (e: MouseEvent): void => {
    pointerX = e.clientX;
    bypassHeld = holdsSnapBypass(e);
    if (!moving) {
      if (Math.abs(pointerX - startX) < DRAW_THRESHOLD_PX) return;
      startMoving();
    }
    update();
  };

  const stop = (): void => {
    controller.abort();
    unsubscribeStore();
    unsubscribeEdgeScroll?.();
    releaseFrames?.();
  };

  const handleUp = (e: MouseEvent): void => {
    stop();
    const timeline = useTimelineStore.getState();
    const draft = timeline.loopRegionDrag?.draft ?? null;
    timeline.setLoopRegionDrag(null);
    if (!moving) {
      if (!edge && !e.shiftKey) timeline.clearSelection();
      return;
    }
    // A draw that ended without a region falls through to the click, which seeks.
    if (!edge && !draft) return;
    swallowTrailingClick();
    if (draft) commitDrawnLoopRegion(draft);
  };

  const cancel = (): void => {
    stop();
    useTimelineStore.getState().setLoopRegionDrag(null);
  };

  // Esc, Clear or a project switch mid-drag cancel it.
  const unsubscribeStore = useTimelineStore.subscribe((state) => {
    const cancelled = moving && state.loopRegionDrag === null;
    if (cancelled || (edge && state.loopRegion === null)) cancel();
  });

  if (edge) startMoving();
  document.addEventListener("mousemove", handleMove, { signal: controller.signal });
  document.addEventListener("mouseup", handleUp, { signal: controller.signal });
  // A release outside the window never reaches the document.
  window.addEventListener("blur", cancel, { signal: controller.signal });
  scrollContainer.addEventListener("scroll", () => moving && update(), { signal: controller.signal, passive: true });
}

// -- Exports -------------------------------------------------------------------

export { startLoopRegionDrag };
