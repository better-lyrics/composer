import { loadVocalOnsets } from "@/audio/vocal-onset-snap-points";
import { useAudioStore } from "@/stores/audio";
import type { AudioSource } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { fileIdentityKey } from "@/utils/file-identity";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

function audioSourceKey(source: AudioSource): string | null {
  if (source?.type === "file") {
    const file = source.file;
    return `file:${fileIdentityKey(file)}`;
  }
  if (source?.type === "youtube") {
    const file = source.file;
    const filePart = file ? `|file:${fileIdentityKey(file)}` : "";
    return `youtube:${source.videoId}${filePart}`;
  }
  return null;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function useVocalOnsetSnapPoints(): void {
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
      const isCurrent = () => running === request && !request.signal.aborted;
      loadVocalOnsets({
        jobKey,
        vocalsUrl,
        signal: request.signal,
        onDetectionStart: () => {
          if (isCurrent()) useTimelineStore.getState().setVocalOnsetDetectionStatus("processing");
        },
      }).then(
        (points) => {
          if (!isCurrent()) return;
          running = null;
          const timeline = useTimelineStore.getState();
          timeline.setVocalOnsetSnapPoints(points);
          timeline.setVocalOnsetDetectionStatus("idle");
        },
        (error: unknown) => {
          if (!isCurrent() || isAbort(error)) return;
          running = null;
          useTimelineStore
            .getState()
            .setVocalOnsetDetectionStatus("error", error instanceof Error ? error.message : String(error));
        },
      );
    };

    const sync = () => {
      const vocalsUrl = useSeparationStore.getState().stemUrls.vocals ?? null;
      const timeline = useTimelineStore.getState();
      if (!vocalsUrl) {
        cancelRunning();
        appliedVocalsUrl = null;
        timeline.setVocalOnsetSnapPoints([]);
        timeline.setVocalOnsetDetectionStatus("idle");
        return;
      }
      if (!useSettingsStore.getState().vocalOnsetSnap) {
        if (!running) return;
        cancelRunning();
        appliedVocalsUrl = null;
        timeline.setVocalOnsetDetectionStatus("idle");
        return;
      }
      if (vocalsUrl === appliedVocalsUrl) return;
      load(vocalsUrl, useSeparationStore.getState().jobKey);
    };

    sync();
    const unsubscribeSeparation = useSeparationStore.subscribe((state, prev) => {
      if (state.stemUrls.vocals === prev.stemUrls.vocals) return;
      sync();
    });
    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.vocalOnsetSnap === prev.vocalOnsetSnap) return;
      sync();
    });
    const unsubscribeAudio = useAudioStore.subscribe((state, prev) => {
      if (audioSourceKey(state.source) === audioSourceKey(prev.source)) return;
      cancelRunning();
      appliedVocalsUrl = null;
      const timeline = useTimelineStore.getState();
      timeline.setVocalOnsetSnapPoints([]);
      useProjectStore.getState().clearCustomSnapPoints();
      timeline.setVocalOnsetDetectionStatus("idle");
    });

    return () => {
      cancelRunning();
      unsubscribeSeparation();
      unsubscribeSettings();
      unsubscribeAudio();
    };
  }, []);
}

export { useVocalOnsetSnapPoints };
