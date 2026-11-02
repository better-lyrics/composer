// -- Interfaces ----------------------------------------------------------------

interface ThemeLeads {
  richsync: number;
  line: number;
}

// -- Helpers -------------------------------------------------------------------

function cssSeconds(value: string): number {
  const trimmed = value.trim();
  const amount = Number.parseFloat(trimmed);
  if (!Number.isFinite(amount)) return 0;
  return trimmed.endsWith("ms") ? amount / 1000 : amount;
}

function themeLeads(element: Element): ThemeLeads {
  const style = getComputedStyle(element);
  return {
    richsync: cssSeconds(style.getPropertyValue("--blyrics-richsync-timing-offset")),
    line: cssSeconds(style.getPropertyValue("--blyrics-timing-offset")),
  };
}

// The lead is perceptual: it hides the sweep's lag while playing, so it is wall-clock time and
// braccato applies it in song time. Paused, the preview shows the exact playhead time instead.
function highlightLeadTrims(leads: ThemeLeads, playbackRate: number, playing: boolean) {
  const scale = playing ? 1 - playbackRate : 1;
  return { richsyncOffsetTrim: leads.richsync * scale, lineOffsetTrim: leads.line * scale };
}

// -- Exports -------------------------------------------------------------------

export { highlightLeadTrims, themeLeads };
