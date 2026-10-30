import { holdFrames, wake } from "@/lib/frame-loop";
import type { FrameClock, FromFrameMessage } from "@/views/preview/frame/preview-frame-protocol";
import type { PlaybackSample, RendererPlayback } from "@/views/preview/renderer-playback";

// -- Interfaces ----------------------------------------------------------------

interface FramePlayback extends RendererPlayback {
  receive: (clock: FrameClock) => void;
  stop: () => void;
}

// -- Constants -----------------------------------------------------------------

// Documents fix timeOrigin at load and their clocks can drift apart (sleep, NTP), so the send
// stamp only measures transit, bounded to what one busy frame can take.
const MAX_TRANSIT_MS = 50;

// -- Functions -----------------------------------------------------------------

// The parent posts its clock once per frame; running it forward from when it arrived keeps the
// sweep on the audio instead of one message behind it, even when the parent drops frames.
function createFramePlayback(post: (message: FromFrameMessage) => void): FramePlayback {
  let clock: FrameClock | null = null;
  let receivedAt = 0;
  let transitMs = 0;
  let releasePlayback: (() => void) | null = null;
  const sample: PlaybackSample = { currentTime: 0, paused: true, playbackRate: 1 };
  const releaseHold = () => {
    releasePlayback?.();
    releasePlayback = null;
  };
  const currentTime = (now: number) => {
    if (!clock) return 0;
    const elapsedMs = clock.playing ? now - receivedAt + transitMs : 0;
    return clock.time + (elapsedMs / 1000) * clock.rate;
  };
  return {
    receive: (next) => {
      clock = next;
      receivedAt = performance.now();
      transitMs = Math.min(MAX_TRANSIT_MS, Math.max(0, performance.timeOrigin + receivedAt - next.sentAt));
      if (next.playing) releasePlayback ??= holdFrames("preview frame playback");
      else releaseHold();
      wake();
    },
    stop: () => {
      if (!clock) return;
      clock = { ...clock, time: currentTime(performance.now()), playing: false };
      releaseHold();
      wake();
    },
    sample: () => {
      if (!clock) return null;
      sample.currentTime = currentTime(performance.now());
      sample.paused = !clock.playing;
      sample.playbackRate = clock.rate;
      return sample;
    },
    seekTo: (seconds) => post({ kind: "seek", seconds }),
    play: () => post({ kind: "play" }),
  };
}

// -- Exports -------------------------------------------------------------------

export { createFramePlayback };
