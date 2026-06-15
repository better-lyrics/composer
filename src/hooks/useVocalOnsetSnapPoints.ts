import { detectVocalOnsetsFromUrl } from "@/audio/vocal-onset-snap-points";
import { useAudioStore } from "@/stores/audio";
import type { AudioSource } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

function audioSourceKey(source: AudioSource): string | null {
  if (source?.type === "file") {
    const file = source.file;
    return `file:${file.name}|${file.size}|${file.lastModified ?? 0}`;
  }
  if (source?.type === "youtube") {
    const file = source.file;
    const filePart = file ? `|file:${file.name}|${file.size}|${file.lastModified ?? 0}` : "";
    return `youtube:${source.videoId}${filePart}`;
  }
  return null;
}

function useVocalOnsetSnapPoints(): void {
  useEffect(() => {
    let lastVocalsUrl: string | null = null;
    let generationId = 0;

    const generate = async (vocalsUrl: string | null) => {
      if (!vocalsUrl) {
        lastVocalsUrl = null;
        const timeline = useTimelineStore.getState();
        timeline.setVocalOnsetSnapPoints([]);
        timeline.setVocalOnsetDetectionStatus("idle");
        return;
      }
      if (vocalsUrl === lastVocalsUrl) return;
      lastVocalsUrl = vocalsUrl;

      const id = ++generationId;
      const timeline = useTimelineStore.getState();
      timeline.setVocalOnsetDetectionStatus("processing");
      try {
        const points = await detectVocalOnsetsFromUrl(vocalsUrl);
        if (id !== generationId) return;
        const nextTimeline = useTimelineStore.getState();
        nextTimeline.setVocalOnsetSnapPoints(points);
        nextTimeline.setVocalOnsetDetectionStatus("idle");
      } catch (err) {
        if (id !== generationId) return;
        useTimelineStore
          .getState()
          .setVocalOnsetDetectionStatus("error", err instanceof Error ? err.message : String(err));
      }
    };

    generate(useSeparationStore.getState().stemUrls.vocals ?? null);
    const unsubscribeSeparation = useSeparationStore.subscribe((state, prev) => {
      const vocalsUrl = state.stemUrls.vocals ?? null;
      const previousVocalsUrl = prev.stemUrls.vocals ?? null;
      if (vocalsUrl === previousVocalsUrl) return;
      generate(vocalsUrl);
    });
    const unsubscribeAudio = useAudioStore.subscribe((state, prev) => {
      if (audioSourceKey(state.source) === audioSourceKey(prev.source)) return;
      generationId++;
      lastVocalsUrl = null;
      const timeline = useTimelineStore.getState();
      timeline.setVocalOnsetSnapPoints([]);
      timeline.setVocalOnsetDetectionStatus("idle");
    });

    return () => {
      generationId++;
      unsubscribeSeparation();
      unsubscribeAudio();
    };
  }, []);
}

export { useVocalOnsetSnapPoints };
