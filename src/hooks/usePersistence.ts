import type { ProjectTab } from "@/domain/project/tab";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { clearAudioFile, saveAudioFile, saveCurrentProject } from "@/lib/persistence";
import {
  cancelPendingSave,
  debouncedSave,
  flushPendingSaveQuietly,
  saveOpenProjectNow,
} from "@/lib/persistence-debounce";
import { markPersistenceSettled } from "@/lib/persistence-settled";
import { setProjectLastTab } from "@/lib/project-repository";
import { isRestoringProject } from "@/lib/project-restore";
import { buildSaveInput, hadStoredAudio, storedAudioFile } from "@/lib/project-snapshot";
import { getSaveStatus, trackSave } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Persistence]";

// -- Helpers ------------------------------------------------------------------

function commitProjectSave(): void {
  const input = buildSaveInput();
  if (!input) return;
  debouncedSave(input);
}

function commitProjectSaveNow(): void {
  const input = buildSaveInput();
  if (!input) return;
  cancelPendingSave();
  trackSave("stem", saveCurrentProject(input, useProjectStore.getState().activeTab)).catch((err) =>
    console.error(LOG_PREFIX, "Immediate save failed:", err),
  );
}

function saveAudioKindNow(): void {
  saveOpenProjectNow().catch((err) => console.error(LOG_PREFIX, "could not save the new audio kind:", err));
}

function rememberLastTab(tab: ProjectTab): void {
  const id = openProjectIdSnapshot();
  if (!id) return;
  setProjectLastTab(id, tab).catch((err) => console.error(`${LOG_PREFIX} could not remember the tab:`, err));
}

// -- Hook ---------------------------------------------------------------------

function usePersistence(): void {
  useEffect(() => {
    restoreOpenProject()
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

  useEffect(
    () =>
      useProjectStore.subscribe((state, previous) => {
        if (isRestoringProject()) return;
        if (state.activeTab !== previous.activeTab) rememberLastTab(state.activeTab);
        if (state.isDirty) commitProjectSave();
      }),
    [],
  );

  // Picking a stem is a discrete action: save it at once instead of waiting for the typing debounce.
  useEffect(
    () =>
      useSeparationStore.subscribe((state, previous) => {
        if (state.currentStem === previous.currentStem || isRestoringProject()) return;
        commitProjectSaveNow();
      }),
    [],
  );

  useEffect(() => {
    let prevSource = useAudioStore.getState().source;
    return useAudioStore.subscribe((state) => {
      if (state.source === prevSource) return;
      const previous = prevSource;
      prevSource = state.source;
      if (isRestoringProject()) return;

      const nextFile = storedAudioFile(state.source);
      if (nextFile && nextFile !== storedAudioFile(previous)) {
        trackSave("audio", saveAudioFile(nextFile)).catch((err) =>
          console.error(`${LOG_PREFIX} audio save failed:`, err),
        );
        if (previous && state.source && previous.type !== state.source.type) saveAudioKindNow();
        return;
      }
      if (!nextFile && hadStoredAudio(previous)) {
        trackSave("audio", clearAudioFile()).catch((err) => console.error(`${LOG_PREFIX} audio clear failed:`, err));
      }
    });
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
      flushPendingSaveQuietly();
      if (getSaveStatus() === "saved") return;
      e.preventDefault();
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { usePersistence };
