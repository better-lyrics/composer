// -- Constants ----------------------------------------------------------------

const PROBE_TIMEOUT_MS = 8000;

// -- Types --------------------------------------------------------------------

type AudioProbeResult = { ok: true; duration: number } | { ok: false };

// -- Probe --------------------------------------------------------------------

function probeAudioUrl(url: string): Promise<AudioProbeResult> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let timer = 0;

    const settle = (result: AudioProbeResult) => {
      window.clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
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

function probeAudioFile(file: File): Promise<AudioProbeResult> {
  const url = URL.createObjectURL(file);
  return probeAudioUrl(url).finally(() => URL.revokeObjectURL(url));
}

// -- Exports ------------------------------------------------------------------

export { probeAudioFile };
