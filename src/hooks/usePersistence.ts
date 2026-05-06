import {
  clearAudioFile,
  debouncedSave,
  flushPendingSave,
  loadAudioFile,
  loadCurrentProject,
  saveAudioFile,
  type SavedAudioSource,
} from "@/lib/persistence";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId };
  return undefined;
}

// -- Hook ---------------------------------------------------------------------

function usePersistence(): void {
  useEffect(() => {
    Promise.all([loadCurrentProject(), loadAudioFile()]).then(([project, file]) => {
      if (project) {
        const state = useProjectStore.getState();
        state.setMetadata(project.metadata);
        state.setLines(project.lines);
        state.setGranularity(project.granularity);
        for (const agent of project.agents) {
          if (!state.agents.find((a) => a.id === agent.id)) {
            state.addAgent(agent);
          }
        }
        state.markClean();
      }

      const savedSource = project?.audioSource;
      if (savedSource?.kind === "youtube") {
        useAudioStore.getState().setYouTubeSource(savedSource.videoId);
      } else if (file) {
        useAudioStore.getState().setSource({ type: "file", file });
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (state.lines.length > 0 || state.metadata.title) {
        const audioSource = toSavedAudioSource(useAudioStore.getState().source);
        debouncedSave(state.metadata, state.agents, state.lines, state.granularity, audioSource);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let prevSource = useAudioStore.getState().source;
    const unsubscribe = useAudioStore.subscribe((state) => {
      if (state.source === prevSource) return;
      const previous = prevSource;
      prevSource = state.source;

      if (state.source?.type === "file") {
        saveAudioFile(state.source.file).catch((err) => console.error("[Persistence] Audio save failed:", err));
        return;
      }
      if (previous?.type === "file") {
        clearAudioFile().catch((err) => console.error("[Persistence] Audio clear failed:", err));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useAudioStore.subscribe((state, prev) => {
      if (state.volume === prev.volume) return;
      if (!useSettingsStore.getState().rememberVolume) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        useSettingsStore.getState().set("lastVolume", state.volume);
      }, 500);
    });
    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useProjectStore.getState();
      if (state.isDirty && state.lines.length > 0) {
        flushPendingSave();
        e.preventDefault();
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { usePersistence };
