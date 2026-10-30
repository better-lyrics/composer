// -- Functions -----------------------------------------------------------------

// Follow calls it in its own frame because the scroll event lands a frame later; callers pass a position already read.
function followRulerScroll(track: HTMLElement, scrollLeft: number): void {
  const translate = `${-scrollLeft}px 0`;
  if (track.style.translate !== translate) track.style.translate = translate;
}

// -- Exports -------------------------------------------------------------------

export { followRulerScroll };
