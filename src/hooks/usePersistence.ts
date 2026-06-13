import type { AudioBlobStore } from "@/lib/audio-blob-store";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { migrateSingleSlotToLibrary } from "@/lib/library-migration";
import { listLibraryProjects } from "@/lib/library-persistence";
import { restoreAudioForProject } from "@/lib/library-resume";
import { saveActiveProject, saveActiveProjectAudio } from "@/lib/library-save";
import { cancelPendingSave, debouncedSave, flushPendingSave } from "@/lib/persistence-debounce";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { useEffect } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Module singletons --------------------------------------------------------

let isBooting = false;
let activeUnsubscribers: Array<() => void> = [];

function attachSubscriptions(): void {
  detachSubscriptions();
  const unsubProject = useProjectStore.subscribe((state) => {
    if (!state.isDirty) return;
    commitProjectSave();
  });
  const unsubSeparation = useSeparationStore.subscribe((state, prevState) => {
    if (state.currentStem === prevState.currentStem) return;
    commitProjectSaveNow();
  });
  let prevSource = useAudioStore.getState().source;
  const unsubAudio = useAudioStore.subscribe((state) => {
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
  activeUnsubscribers = [unsubProject, unsubSeparation, unsubAudio];
}

function detachSubscriptions(): void {
  for (const fn of activeUnsubscribers) fn();
  activeUnsubscribers = [];
}

// -- Helpers ------------------------------------------------------------------

function playableFile(source: AudioSource): File | null {
  if (!source) return null;
  if (source.type === "file") return source.file;
  if (source.type === "youtube") return source.file ?? null;
  return null;
}

function shouldSave(): boolean {
  if (isBooting) return false;
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

async function resumeMostRecentProject(deps: { audioBlobs: AudioBlobStore }): Promise<string | undefined> {
  const result = await migrateSingleSlotToLibrary(deps);
  let resumeId = result.migratedId;
  if (!resumeId) {
    const list = await listLibraryProjects();
    if (list.length > 0) resumeId = list[0].id;
  }
  if (!resumeId) return undefined;

  await useProjectStore.getState().setActiveProject(resumeId, deps);
  await restoreAudioForProject(resumeId, deps);

  if (result.justMigrated) {
    toast("Your project is now in your library");
  }

  return resumeId;
}

// -- Hook ---------------------------------------------------------------------

function usePersistence(): void {
  useEffect(() => {
    isBooting = true;
    let cancelled = false;
    void (async () => {
      let resumedId: string | undefined;
      try {
        resumedId = await resumeMostRecentProject({ audioBlobs });
      } catch (err) {
        console.error(`${LOG_PREFIX} initial load failed:`, err);
      }
      if (cancelled) return;
      useUIStore.getState().setViewingLibrary(resumedId === undefined);
      isBooting = false;
      attachSubscriptions();
      if (import.meta.env.DEV) {
        console.log(`${LOG_PREFIX} settled`, {
          title: useProjectStore.getState().metadata.title,
          source: useAudioStore.getState().source,
        });
      }
      markPersistenceSettled();
    })();
    return () => {
      cancelled = true;
      detachSubscriptions();
    };
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
