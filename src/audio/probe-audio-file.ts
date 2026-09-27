// -- Constants ----------------------------------------------------------------

const PROBE_TIMEOUT_MS = 8000;

// -- Types --------------------------------------------------------------------

type AudioProbeResult = { ok: true; duration: number } | { ok: false };

// -- Probe --------------------------------------------------------------------

function probeAudioFile(file: File): Promise<AudioProbeResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let timer = 0;

    const settle = (result: AudioProbeResult) => {
      window.clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const onMetadata = () =>
      settle(Number.isFinite(audio.duration) ? { ok: true, duration: audio.duration } : { ok: false });
    const onError = () => settle({ ok: false });

    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("error", onError);
    timer = window.setTimeout(onError, PROBE_TIMEOUT_MS);
    audio.preload = "metadata";
    audio.src = url;
  });
}

// -- Exports ------------------------------------------------------------------

export { probeAudioFile };
