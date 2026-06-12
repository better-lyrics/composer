import { OpfsAudioBlobStore } from "@/lib/audio-blob-store";
import { saveActiveProject, saveActiveProjectAudio } from "@/lib/library-save";
import { cancelPendingSave, debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module singletons --------------------------------------------------------

const audioBlobs = new OpfsAudioBlobStore();

// -- Helpers ------------------------------------------------------------------

function playableFile(source: AudioSource): File | null {
  if (!source) return null;
  if (source.type === "file") return source.file;
  if (source.type === "youtube") return source.file ?? null;
  return null;
}

function shouldSave(): boolean {
  const projectState = useProjectStore.getState();
  if (!projectState.activeProjectId) return false;
  const liveAudioSource = useAudioStore.getState().source;
  const hasContent = projectState.lines.length > 0 || projectState.metadata.title !== "";
  const hasContext = liveAudioSource !== null;
  return hasContent || hasContext;
}

function commitProjectSave(): void {
  if (!shouldSave()) return;
  debouncedSave(() => saveActiveProject());
}

function commitProjectSaveNow(): void {
  if (!shouldSave()) return;
  cancelPendingSave();
  saveActiveProject().catch((err) => console.error(LOG_PREFIX, "Immediate save failed:", err));
}

// -- Hook ---------------------------------------------------------------------

function usePersistence(): void {
  useEffect(() => {
    void (async () => {
      try {
        // Placeholder for Task 3.3: migration + library-load flow.
        // Until 3.3 lands, leave this as a no-op so existing tests can mount
        // the hook without crashing.
      } catch (err) {
        console.error(`${LOG_PREFIX} initial load failed:`, err);
      } finally {
        if (import.meta.env.DEV) {
          console.log(`${LOG_PREFIX} settled`, {
            title: useProjectStore.getState().metadata.title,
            source: useAudioStore.getState().source,
          });
        }
        markPersistenceSettled();
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (!state.isDirty) return;
      commitProjectSave();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = useSeparationStore.subscribe((state, prevState) => {
      if (state.currentStem === prevState.currentStem) return;
      commitProjectSaveNow();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let prevSource = useAudioStore.getState().source;
    const unsubscribe = useAudioStore.subscribe((state) => {
      if (state.source === prevSource) return;
      const previous = prevSource;
      prevSource = state.source;

      if (!useProjectStore.getState().activeProjectId) return;

      const nextFile = playableFile(state.source);
      const prevFile = playableFile(previous);

      if (nextFile && nextFile !== prevFile) {
        saveActiveProjectAudio(nextFile, { audioBlobs }).catch((err) =>
          console.error(`${LOG_PREFIX} audio save failed:`, err),
        );
        return;
      }
      if (!nextFile && prevFile) {
        saveActiveProjectAudio(null, { audioBlobs }).catch((err) =>
          console.error(`${LOG_PREFIX} audio clear failed:`, err),
        );
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
      flushPendingSave();
      const state = useProjectStore.getState();
      if (state.isDirty && state.lines.length > 0) {
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
