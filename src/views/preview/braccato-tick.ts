import { highlightLeadTrims, themeLeads } from "@/views/preview/highlight-lead";
import type { PlaybackSample } from "@/views/preview/renderer-playback";
import type { BraccatoLyricsElement } from "@braccato/core/element";

// -- Interfaces ----------------------------------------------------------------

interface AppliedTick {
  element: BraccatoLyricsElement;
  time: number;
  playing: boolean;
  animating: boolean;
  playbackRate: number;
}

// -- Functions -----------------------------------------------------------------

// Hands the element one playback sample and returns what it applied. The renderer draws on its own
// frames and carries a playing clock forward between samples, so only a changed sample is written.
function tickBraccato(el: BraccatoLyricsElement, sample: PlaybackSample, applied: AppliedTick | null): AppliedTick {
  // While the time still crawls after a play, the sweep follows each sample instead of running ahead.
  const playing = !sample.paused;
  const animating = playing && sample.followsAudio;
  const { currentTime: time, playbackRate } = sample;
  const isSameElement = applied?.element === el;
  if (!isSameElement || applied.playbackRate !== playbackRate || applied.playing !== playing) {
    // Without the rate the word sweeps run on the wall clock and stutter at any speed but 1x.
    el.tickOptions = { playbackRate, ...highlightLeadTrims(themeLeads(el), playbackRate, playing) };
  }
  if (!isSameElement || applied.animating !== animating) el.playing = animating;
  if (!isSameElement || applied.time !== time) el.currentTime = time;
  return { element: el, time, playing, animating, playbackRate };
}

// -- Exports -------------------------------------------------------------------

export { tickBraccato };
export type { AppliedTick };
