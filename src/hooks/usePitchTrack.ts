import { loadPitchTrack } from "@/audio/pitch/load-pitch-track";
import { type AudioSource, playableFile, useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { isAbortError } from "@/utils/abort-error";
import { fileIdentityKey } from "@/utils/file-identity";
import { clearPitchSession, setPitchSessionTrack } from "@/views/timeline/pitch/pitch-session";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Pitch]";

// -- Functions ----------------------------------------------------------------

function playableFileKey(source: AudioSource): string | null {
  const file = playableFile(source);
  return file ? fileIdentityKey(file) : null;
}

// The only driver of pitch detection: it follows the vocal stem, the pitch line setting and the song.
function usePitchTrack(): void {
  useEffect(() => {
    let running: AbortController | null = null;
    let appliedVocalsUrl: string | null = null;

    const cancelRunning = () => {
      running?.abort();
      running = null;
    };

    const load = (vocalsUrl: string, jobKey: string | null) => {
      cancelRunning();
      const request = new AbortController();
      running = request;
      appliedVocalsUrl = vocalsUrl;
      let detected = false;
      const isCurrent = () => running === request && !request.signal.aborted;
      loadPitchTrack({
        jobKey,
        vocalsUrl,
        signal: request.signal,
        onDetectionStart: () => {
          detected = true;
        },
      }).then(
        (track) => {
          if (!isCurrent()) return;
          running = null;
          setPitchSessionTrack(track, jobKey, detected ? performance.now() : null);
        },
        (error: unknown) => {
          if (!isCurrent() || isAbortError(error)) return;
          running = null;
          appliedVocalsUrl = null;
          console.error(LOG_PREFIX, "could not detect pitch", error);
        },
      );
    };

    const sync = () => {
      const { stemUrls, jobKey } = useSeparationStore.getState();
      const vocalsUrl = stemUrls.vocals ?? null;
      if (!vocalsUrl) {
        cancelRunning();
        appliedVocalsUrl = null;
        clearPitchSession();
        return;
      }
      if (useSettingsStore.getState().pitchLine === "off") {
        if (!running) return;
        cancelRunning();
        appliedVocalsUrl = null;
        return;
      }
      if (vocalsUrl === appliedVocalsUrl) return;
      load(vocalsUrl, jobKey);
    };

    sync();
    const unsubscribeSeparation = useSeparationStore.subscribe((state, prev) => {
      if (state.stemUrls.vocals !== prev.stemUrls.vocals) sync();
    });
    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.pitchLine !== prev.pitchLine) sync();
    });
    // A new song swaps the stem URLs once its stem job is read; until then the old pitch must not show.
    const unsubscribeAudio = useAudioStore.subscribe((state, prev) => {
      if (playableFileKey(state.source) === playableFileKey(prev.source)) return;
      cancelRunning();
      appliedVocalsUrl = null;
      clearPitchSession();
    });

    return () => {
      cancelRunning();
      unsubscribeSeparation();
      unsubscribeSettings();
      unsubscribeAudio();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { usePitchTrack };
