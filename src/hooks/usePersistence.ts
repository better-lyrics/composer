import {
  clearAudioFile,
  loadAudioFile,
  loadCurrentProject,
  saveAudioFile,
  type SavedAudioSource,
} from "@/lib/persistence";
import { debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Helpers ------------------------------------------------------------------

function toSavedAudioSource(source: AudioSource): SavedAudioSource | undefined {
  if (!source) return undefined;
  if (source.type === "file") return { kind: "file", name: source.file.name };
  if (source.type === "youtube") return { kind: "youtube", videoId: source.videoId };
  return undefined;
}

function playableFile(source: AudioSource): File | null {
  if (!source) return null;
  if (source.type === "file") return source.file;
  if (source.type === "youtube") return source.file ?? null;
  return null;
}

// -- Hook ---------------------------------------------------------------------

function usePersistence(): void {
  useEffect(() => {
    Promise.all([loadCurrentProject(), loadAudioFile()])
      .then(([project, file]) => {
        if (project) {
          const issues: string[] = [];
          const safeLines = project.lines ?? [];
          if (!project.lines) issues.push("missing lines");
          const safeAgents = project.agents && project.agents.length > 0 ? project.agents : DEFAULT_AGENTS;
          if (!project.agents || project.agents.length === 0) issues.push("missing or empty agents");
          const safeGranularity = project.granularity ?? useSettingsStore.getState().defaultGranularity;
          if (project.granularity === undefined) issues.push("missing granularity");
          if (issues.length > 0) {
            console.warn(
              `${LOG_PREFIX} loaded project has malformed fields (${issues.join(", ")}); using safe defaults. The raw record is still in IndexedDB; visit /recover to download it.`,
            );
          }

          const state = useProjectStore.getState();
          state.setMetadata(project.metadata);
          state.setLines(safeLines);
          state.setGroups(project.groups ?? []);
          state.setGranularity(safeGranularity);
          state.setSyllableSplitDefaults(project.syllableSplitDefaults ?? DEFAULT_SYLLABLE_SPLIT_DEFAULTS);
          state.setAgents(safeAgents);
          state.setDismissedSuggestions(project.dismissedSuggestions ?? []);
          state.setDismissedExplicitSuggestions(project.dismissedExplicitSuggestions ?? []);
          state.markClean();
        }

        const savedSource = project?.audioSource;
        if (savedSource?.kind === "youtube") {
          useAudioStore.getState().setYouTubeSource(savedSource.videoId, file);
        } else if (file) {
          useAudioStore.getState().setSource({ type: "file", file });
        }
      })
      .catch((err) => {
        console.error(`${LOG_PREFIX} initial load failed:`, err);
      })
      .finally(() => {
        if (import.meta.env.DEV) {
          console.log(`${LOG_PREFIX} settled`, {
            title: useProjectStore.getState().metadata.title,
            source: useAudioStore.getState().source,
          });
        }
        markPersistenceSettled();
      });
  }, []);

  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (state.lines.length > 0 || state.metadata.title) {
        const audioSource = toSavedAudioSource(useAudioStore.getState().source);
        debouncedSave(
          state.metadata,
          state.agents,
          state.lines,
          state.groups,
          state.granularity,
          state.syllableSplitDefaults,
          audioSource,
          state.dismissedSuggestions,
          state.dismissedExplicitSuggestions,
        );
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

      const nextFile = playableFile(state.source);
      const prevFile = playableFile(previous);

      if (nextFile && nextFile !== prevFile) {
        saveAudioFile(nextFile).catch((err) => console.error(`${LOG_PREFIX} audio save failed:`, err));
        return;
      }
      if (!nextFile && prevFile) {
        clearAudioFile().catch((err) => console.error(`${LOG_PREFIX} audio clear failed:`, err));
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
