// -- Helpers ------------------------------------------------------------------

function cssSeconds(value: string): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  if (!Number.isFinite(amount)) return 0;
  return trimmed.endsWith("ms") ? amount / 1000 : amount;
}

// Braccato's highlight lead is perceptual, so it is wall-clock time, but braccato applies it in
// song time. Trimming it by (1 - rate) keeps the lead the same on screen at any playback speed.
function rateScaledOffsetTrims(element: Element, playbackRate: number) {
  const style = getComputedStyle(element);
  const scale = 1 - playbackRate;
  return {
    richsyncOffsetTrim: cssSeconds(style.getPropertyValue("--blyrics-richsync-timing-offset")) * scale,
    lineOffsetTrim: cssSeconds(style.getPropertyValue("--blyrics-timing-offset")) * scale,
  };
}

// -- Exports ------------------------------------------------------------------

export { rateScaledOffsetTrims };
