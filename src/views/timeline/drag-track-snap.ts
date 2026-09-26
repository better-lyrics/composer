import type { ClientRect, Modifier } from "@dnd-kit/core";
import { trackElementAt } from "@/views/timeline/drag-end-resolution";
import { BLOCK_INSET_PX } from "@/views/timeline/row-geometry";

// -- Functions -----------------------------------------------------------------

function trackSnapOffsetY(pointerX: number, pointerY: number, activeTop: number): number | null {
  const track = trackElementAt(pointerX, pointerY);
  if (!track) return null;
  return track.getBoundingClientRect().top + BLOCK_INSET_PX - activeTop;
}

// dnd-kit anchors the overlay at the source rect from drag start, but re-measures activeNodeRect as rows mount.
const dragStartTops = new WeakMap<Event, number>();

function dragStartTop(activatorEvent: Event, activeNodeRect: ClientRect): number {
  const known = dragStartTops.get(activatorEvent);
  if (known !== undefined) return known;
  dragStartTops.set(activatorEvent, activeNodeRect.top);
  return activeNodeRect.top;
}

const trackSnapModifier: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!(activatorEvent instanceof PointerEvent) || !activeNodeRect) return transform;
  const offsetY = trackSnapOffsetY(
    activatorEvent.clientX + transform.x,
    activatorEvent.clientY + transform.y,
    dragStartTop(activatorEvent, activeNodeRect),
  );
  return offsetY === null ? transform : { ...transform, y: offsetY };
};

// -- Exports -------------------------------------------------------------------

export { trackSnapModifier, trackSnapOffsetY };
