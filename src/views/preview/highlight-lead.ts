// -- Interfaces ----------------------------------------------------------------

// The leads braccato's lines use, in seconds, from `Renderer.timingOffsets()`.
interface HighlightLeads {
  richsync: number;
  line: number;
}

// -- Functions -----------------------------------------------------------------

// The lead is perceptual: it hides the sweep's lag while playing, so it is wall-clock time and
// braccato applies it in song time. Paused, the preview shows the exact playhead time instead.
function highlightLeadTrims(leads: HighlightLeads, playbackRate: number, playing: boolean) {
  const scale = playing ? 1 - playbackRate : 1;
  return { richsyncOffsetTrim: leads.richsync * scale, lineOffsetTrim: leads.line * scale };
}

// -- Exports -------------------------------------------------------------------

export { highlightLeadTrims };
