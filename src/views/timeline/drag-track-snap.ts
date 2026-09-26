import type { Modifier } from "@dnd-kit/core";
import { trackElementAt } from "@/views/timeline/drag-end-resolution";
import { BLOCK_INSET_PX } from "@/views/timeline/row-geometry";

// -- Functions -----------------------------------------------------------------

function trackSnapOffsetY(pointerX: number, pointerY: number, activeTop: number): number | null {
  const track = trackElementAt(pointerX, pointerY);
  if (!track) return null;
  return track.getBoundingClientRect().top + BLOCK_INSET_PX - activeTop;
}

const trackSnapModifier: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  if (!(activatorEvent instanceof PointerEvent) || !activeNodeRect) return transform;
  const offsetY = trackSnapOffsetY(
    activatorEvent.clientX + transform.x,
    activatorEvent.clientY + transform.y,
    activeNodeRect.top,
  );
  return offsetY === null ? transform : { ...transform, y: offsetY };
};

// -- Exports -------------------------------------------------------------------

export { trackSnapModifier, trackSnapOffsetY };
