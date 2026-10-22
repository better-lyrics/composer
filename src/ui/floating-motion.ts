import { type FloatingContext, type Placement, type VirtualElement, useTransitionStyles } from "@floating-ui/react";

// -- Constants ----------------------------------------------------------------

const ENTRANCE_MS = 150;
const ENTRANCE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ORIGIN_SIDE: Record<string, string> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const ORIGIN_ALIGN_X: Record<string, string> = { start: "left", end: "right" };
const ORIGIN_ALIGN_Y: Record<string, string> = { start: "top", end: "bottom" };

// -- Functions ----------------------------------------------------------------

// The floating layer grows out of the edge and corner that touch its trigger.
function entranceOrigin(placement: Placement): string {
  const [side, align] = placement.split("-");
  const vertical = side === "top" || side === "bottom";
  const across = align ? (vertical ? ORIGIN_ALIGN_X : ORIGIN_ALIGN_Y)[align] : "center";
  return vertical ? `${across} ${ORIGIN_SIDE[side]}` : `${ORIGIN_SIDE[side]} ${across}`;
}

// Triggers shrink while pressed, so position against their layout box: the popover never drifts as the press springs back.
function unscaledReference(element: HTMLElement): VirtualElement {
  return {
    contextElement: element,
    getBoundingClientRect: () => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const { offsetWidth: width, offsetHeight: height } = element;
      return DOMRect.fromRect({ x: centerX - width / 2, y: centerY - height / 2, width, height });
    },
  };
}

// -- Hooks --------------------------------------------------------------------

function useFloatingEntrance(context: FloatingContext) {
  return useTransitionStyles(context, {
    duration: ENTRANCE_MS,
    initial: { opacity: 0, scale: "0.97" },
    common: ({ placement }) => ({
      transformOrigin: entranceOrigin(placement),
      transitionTimingFunction: ENTRANCE_EASE,
    }),
  });
}

// -- Exports ------------------------------------------------------------------

export { unscaledReference, useFloatingEntrance };
