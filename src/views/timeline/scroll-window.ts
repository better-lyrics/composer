// -- Functions -----------------------------------------------------------------

// Where a drawn strip of `windowWidth` px starts so it covers the visible part of the song. The strip stays put
// while the view moves inside it, so it is redrawn only when the view leaves it.
function scrollWindowStart(
  current: number,
  visibleStart: number,
  visibleEnd: number,
  contentWidth: number,
  windowWidth: number,
): number {
  const maxStart = Math.max(0, contentWidth - windowWidth);
  if (current <= maxStart && current <= visibleStart && current + windowWidth >= visibleEnd) return current;
  const centred = visibleStart - (windowWidth - (visibleEnd - visibleStart)) / 2;
  return Math.round(Math.min(maxStart, Math.max(0, centred)));
}

// -- Exports -------------------------------------------------------------------

export { scrollWindowStart };
