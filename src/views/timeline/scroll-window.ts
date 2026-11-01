// -- Interfaces ----------------------------------------------------------------

interface Strip {
  start: number;
  width: number;
}

// -- Constants -----------------------------------------------------------------

// Canvas strips span this many views, so a scroll moves a still canvas instead of redrawing it.
const STRIP_SCREENS = 2;
// Room for a fractional scroll position at each edge of a view-wide strip.
const STRIP_EDGE_SLACK = 1;

// -- Functions -----------------------------------------------------------------

function centredWindowStart(visibleStart: number, visibleEnd: number, contentWidth: number, windowWidth: number): number {
  const maxStart = Math.max(0, contentWidth - windowWidth);
  const centred = visibleStart - (windowWidth - (visibleEnd - visibleStart)) / 2;
  return Math.round(Math.min(maxStart, Math.max(0, centred)));
}

// A drawn window stays put while it still covers the view, so it is redrawn only when the view leaves it.
function scrollWindowStart(
  current: number,
  visibleStart: number,
  visibleEnd: number,
  contentWidth: number,
  windowWidth: number,
): number {
  const maxStart = Math.max(0, contentWidth - windowWidth);
  if (current <= maxStart && current <= visibleStart && current + windowWidth >= visibleEnd) return current;
  return centredWindowStart(visibleStart, visibleEnd, contentWidth, windowWidth);
}

// A new width recentres the strip, so it starts with room on both sides.
function stripFor(
  previous: Strip | null,
  scrollLeft: number,
  viewportWidth: number,
  contentWidth: number,
  screens: number,
): Strip {
  const width = viewportWidth * screens + 2 * STRIP_EDGE_SLACK;
  const visibleStart = Math.floor(scrollLeft);
  const visibleEnd = Math.ceil(scrollLeft + viewportWidth);
  const start =
    previous?.width === width
      ? scrollWindowStart(previous.start, visibleStart, visibleEnd, contentWidth, width)
      : centredWindowStart(visibleStart, visibleEnd, contentWidth, width);
  return previous?.start === start && previous.width === width ? previous : { start, width };
}

// -- Exports -------------------------------------------------------------------

export { STRIP_SCREENS, scrollWindowStart, stripFor };
export type { Strip };
