// -- Functions ----------------------------------------------------------------

function followBandPointer(band: HTMLElement, onMove: (e: PointerEvent) => void, hide: () => void): () => void {
  const handlePointerMove = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("[data-band-resize-handle]")) return hide();
    onMove(e);
  };
  band.addEventListener("pointermove", handlePointerMove);
  band.addEventListener("pointerleave", hide);
  return () => {
    band.removeEventListener("pointermove", handlePointerMove);
    band.removeEventListener("pointerleave", hide);
    hide();
  };
}

// -- Exports ------------------------------------------------------------------

export { followBandPointer };
