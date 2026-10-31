// -- State ---------------------------------------------------------------------

const resumeSeekTargets = new WeakMap<HTMLMediaElement, number>();

// -- Functions -----------------------------------------------------------------

// Chromium drops the audio it had buffered when it paused; a seek in place before play() resumes from the paused sample.
function seekInPlaceToResume(audio: HTMLMediaElement): void {
  const pausedAt = audio.currentTime;
  resumeSeekTargets.set(audio, pausedAt);
  audio.addEventListener("seeked", () => resumeSeekTargets.delete(audio), { once: true });
  audio.currentTime = pausedAt;
}

function isResumeSeek(audio: HTMLMediaElement): boolean {
  return resumeSeekTargets.get(audio) === audio.currentTime;
}

// -- Exports -------------------------------------------------------------------

export { isResumeSeek, seekInPlaceToResume };
