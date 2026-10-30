// -- Functions -----------------------------------------------------------------

// Callers pass a position they already read, so the write never forces a style recalc. The playhead
// frame calls it in the frame that follow scrolls, because the scroll event only arrives a frame later.
function followRulerScroll(track: HTMLElement, scrollLeft: number): void {
  const translate = `${-scrollLeft}px 0`;
  if (track.style.translate !== translate) track.style.translate = translate;
}

// -- Exports -------------------------------------------------------------------

export { followRulerScroll };
