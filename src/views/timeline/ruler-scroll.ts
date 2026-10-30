// -- Functions -----------------------------------------------------------------

// The panel calls this from its scroll handler after reading the position, so the write never forces a style recalc.
function followRulerScroll(track: HTMLElement, scrollLeft: number): void {
  track.style.translate = `${-scrollLeft}px 0`;
}

// -- Exports -------------------------------------------------------------------

export { followRulerScroll };
