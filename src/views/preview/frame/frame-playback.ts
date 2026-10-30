import type { FrameClock, FromFrameMessage } from "@/views/preview/frame/preview-frame-protocol";
import type { PlaybackSample, RendererPlayback } from "@/views/preview/renderer-playback";

// -- Interfaces ----------------------------------------------------------------

interface FramePlayback extends RendererPlayback {
  receive: (clock: FrameClock) => void;
}

// -- Functions -----------------------------------------------------------------

// The parent posts its clock once per frame; running it forward from the send time keeps the
// sweep on the audio instead of one message behind it.
function createFramePlayback(post: (message: FromFrameMessage) => void): FramePlayback {
  let clock: FrameClock | null = null;
  const sample: PlaybackSample = { currentTime: 0, paused: true, playbackRate: 1 };
  return {
    receive: (next) => {
      clock = next;
    },
    sample: () => {
      if (!clock) return null;
      const elapsedSeconds = clock.playing ? (performance.timeOrigin + performance.now() - clock.sentAt) / 1000 : 0;
      sample.currentTime = clock.time + Math.max(0, elapsedSeconds) * clock.rate;
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
