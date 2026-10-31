// -- Types ---------------------------------------------------------------------

// "none": the seek moves nothing the user should see; "centre": a deliberate jump, centred like Jump to playhead.
type SeekReveal = "none" | "centre";

// -- Constants -----------------------------------------------------------------

// The element reads a target back rounded to its own time resolution.
const SAME_TARGET_SECONDS = 0.001;

// -- State ---------------------------------------------------------------------

const pendingReveals = new WeakMap<HTMLMediaElement, { target: number; reveal: SeekReveal }>();

// -- Functions -----------------------------------------------------------------

function seekWithReveal(audio: HTMLMediaElement, time: number, reveal: SeekReveal): void {
  pendingReveals.set(audio, { target: time, reveal });
  audio.addEventListener("seeked", () => pendingReveals.delete(audio), { once: true });
  audio.currentTime = time;
}

// Chromium drops the audio it had buffered when it paused; a seek in place before play() resumes from the paused sample.
function seekInPlaceToResume(audio: HTMLMediaElement): void {
  seekWithReveal(audio, audio.currentTime, "none");
}

// Matched on the target, so a later seek that interrupts this one reveals as usual.
function seekRevealOf(audio: HTMLMediaElement): SeekReveal | null {
  const pending = pendingReveals.get(audio);
  return pending && Math.abs(pending.target - audio.currentTime) < SAME_TARGET_SECONDS ? pending.reveal : null;
}

// -- Exports -------------------------------------------------------------------

export { seekInPlaceToResume, seekRevealOf, seekWithReveal };
export type { SeekReveal };
