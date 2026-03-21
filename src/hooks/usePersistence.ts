import { debouncedSave, flushPendingSave, loadAudioFile, loadCurrentProject, saveAudioFile } from "@/lib/persistence";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

function usePersistence(): void {
  // Load saved project on mount
  useEffect(() => {
    loadCurrentProject().then((project) => {
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
    });

    loadAudioFile().then((file) => {
      if (file) {
        useAudioStore.getState().setSource({ type: "file", file });
      }
    });
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (state.lines.length > 0 || state.metadata.title) {
        const audioSource = useAudioStore.getState().source;
        const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
        debouncedSave(state.metadata, state.agents, state.lines, state.granularity, audioFileName);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save audio file to IndexedDB when source changes
  useEffect(() => {
    let prevSource = useAudioStore.getState().source;
    const unsubscribe = useAudioStore.subscribe((state) => {
      if (state.source === prevSource) return;
      prevSource = state.source;
      if (state.source?.type === "file") {
        saveAudioFile(state.source.file).catch((err) => console.error("[Persistence] Audio save failed:", err));
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist volume to settings store
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

  // Warn on tab close if dirty
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

export { usePersistence };
