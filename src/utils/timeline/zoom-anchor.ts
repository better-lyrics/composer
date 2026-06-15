function computeAnchoredScrollLeft(anchorTime: number, anchorViewportX: number, newZoom: number): number {
  return Math.max(0, anchorTime * newZoom - anchorViewportX);
}

export { computeAnchoredScrollLeft };
