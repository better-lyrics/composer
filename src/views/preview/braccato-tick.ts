import { highlightLeadTrims, themeLeads } from "@/views/preview/highlight-lead";
import type { PlaybackSample } from "@/views/preview/renderer-playback";
import type { BraccatoLyricsElement } from "@braccato/core/element";

// -- Interfaces ----------------------------------------------------------------

interface AppliedTick {
  element: BraccatoLyricsElement;
  playing: boolean;
  animating: boolean;
  playbackRate: number;
}

// -- Functions -----------------------------------------------------------------

// Drives one frame of the element from a playback sample and returns what it applied. The rate
// and play state are tracked by the caller rather than read back off the element, which has no
// properties to read until the registration import lands.
function tickBraccato(el: BraccatoLyricsElement, sample: PlaybackSample, applied: AppliedTick | null): AppliedTick {
  const playing = !sample.paused;
  const animating = playing && sample.followsAudio;
  const { playbackRate } = sample;
  if (
    applied?.element === el &&
    applied.playing === playing &&
    applied.animating === animating &&
    applied.playbackRate === playbackRate
  ) {
    el.currentTime = sample.currentTime;
    return applied;
  }
  // Without the rate the word sweeps run on the wall clock and stutter at any speed but 1x.
  el.tickOptions = {
    playbackRate,
    followPausedSeeks: true,
    ...highlightLeadTrims(themeLeads(el), playbackRate, playing),
  };
  if (animating) {
    el.currentTime = sample.currentTime;
    el.playing = true;
  } else {
    // Braccato resyncs paused sweeps only on a paused seek, so pause first: each time write then
    // sets the sweep exactly, dropping a stale lead on pause and following the crawl after a play.
    el.playing = false;
    el.currentTime = sample.currentTime;
  }
  return { element: el, playing, animating, playbackRate };
}

// -- Exports -------------------------------------------------------------------

export { tickBraccato };
export type { AppliedTick };
