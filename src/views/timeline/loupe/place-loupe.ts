// -- Types --------------------------------------------------------------------

interface PlainRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface LoupePlacementInput {
  anchorX: number;
  lane: PlainRect;
  bounds: PlainRect;
  size: { width: number; height: number };
}

interface LoupePlacement {
  left: number;
  top: number;
  side: "above" | "below";
  tailX: number;
}

// -- Constants ----------------------------------------------------------------

const LANE_GAP = 12;
const BOUNDS_MARGIN = 8;
const TAIL_INSET = 20;

// -- Functions ----------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// When neither side fits, the roomier side wins and the card may overflow: covering the lane is worse.
function sideFor({ lane, bounds, size }: LoupePlacementInput): "above" | "below" {
  if (lane.top - LANE_GAP - size.height >= bounds.top + BOUNDS_MARGIN) return "above";
  if (lane.bottom + LANE_GAP + size.height <= bounds.bottom - BOUNDS_MARGIN) return "below";
  return lane.top - bounds.top >= bounds.bottom - lane.bottom ? "above" : "below";
}

function placeLoupe(input: LoupePlacementInput): LoupePlacement {
  const { anchorX, lane, bounds, size } = input;
  const side = sideFor(input);
  const top = side === "above" ? lane.top - LANE_GAP - size.height : lane.bottom + LANE_GAP;
  const left = clamp(
    anchorX - size.width / 2,
    bounds.left + BOUNDS_MARGIN,
    Math.max(bounds.left + BOUNDS_MARGIN, bounds.right - size.width - BOUNDS_MARGIN),
  );
  const tailX = clamp(anchorX - left, TAIL_INSET, size.width - TAIL_INSET);
  return { left, top, side, tailX };
}

// -- Exports ------------------------------------------------------------------

export { placeLoupe };
