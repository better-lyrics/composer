import { useCallback } from "react";
import type { LibraryProject } from "@/domain/project/library-project";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { deleteLibraryProject, getLibraryProject, putLibraryProject } from "@/lib/library-persistence";
import { exportProjectToFile } from "@/lib/persistence";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { useInvalidateLibraryProjects } from "@/hooks/useLibraryProjects";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { generateTTML } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

interface LibraryActionsApi {
  rename: (id: string, newTitle: string) => Promise<void>;
  duplicate: (id: string) => Promise<string | undefined>;
  togglePin: (id: string) => Promise<void>;
  evictAudio: (id: string) => Promise<void>;
  exportTtml: (id: string) => Promise<void>;
  exportProjectJson: (id: string) => Promise<void>;
  delete: (id: string) => Promise<boolean>;
}

// -- Helpers ------------------------------------------------------------------

function cloneProject(project: LibraryProject, id: string, now: number): LibraryProject {
  const cloned: LibraryProject = structuredClone(project);
  cloned.id = id;
  cloned.metadata = { ...cloned.metadata, title: `${cloned.metadata.title} (copy)` };
  cloned.pinned = false;
  cloned.createdAt = now;
  cloned.updatedAt = now;
  cloned.lastOpenedAt = now;
  cloned.audioBytesCached = false;
  return cloned;
}

function downloadTtml(project: LibraryProject): void {
  const ttml = generateTTML({
    metadata: project.metadata,
    agents: project.agents,
    lines: project.lines,
    groups: project.groups,
    granularity: project.granularity,
    minify: true,
    duration: project.metadata.duration > 0 ? project.metadata.duration : undefined,
  });
  const blob = new Blob([ttml], { type: "application/ttml+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.metadata.title || "lyrics"}.ttml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -- Hook ---------------------------------------------------------------------

function useLibraryActions(): LibraryActionsApi {
  const invalidate = useInvalidateLibraryProjects();
  const confirm = useConfirm();

  const rename = useCallback(
    async (id: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      const project = await getLibraryProject(id);
      if (!project) return;
      if (project.metadata.title === trimmed) return;
      await putLibraryProject({
        ...project,
        metadata: { ...project.metadata, title: trimmed },
        updatedAt: Date.now(),
      });
      await invalidate();
    },
    [invalidate],
  );

  const duplicate = useCallback(
    async (id: string): Promise<string | undefined> => {
      const project = await getLibraryProject(id);
      if (!project) return undefined;
      const newId = crypto.randomUUID();
      const now = Date.now();
      const copy = cloneProject(project, newId, now);

      if (project.audioBytesCached) {
        const bytes = await audioBlobs.get(id);
        if (bytes) {
          await audioBlobs.put(newId, bytes);
          copy.audioBytesCached = true;
        }
      }

      await putLibraryProject(copy);
      await invalidate();
      return newId;
    },
    [invalidate],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const project = await getLibraryProject(id);
      if (!project) return;
      await putLibraryProject({
        ...project,
        pinned: !project.pinned,
        updatedAt: Date.now(),
      });
      await invalidate();
    },
    [invalidate],
  );

  const evictAudio = useCallback(
    async (id: string) => {
      const project = await getLibraryProject(id);
      if (!project) return;
      if (project.audioSource?.kind !== "youtube") return;
      await audioBlobs.delete(id);
      await putLibraryProject({
        ...project,
        audioBytesCached: false,
        updatedAt: Date.now(),
      });
      await invalidate();
    },
    [invalidate],
  );

  const exportTtml = useCallback(async (id: string) => {
    if (id === useProjectStore.getState().activeProjectId) {
      await flushPendingSave();
    }
    const project = await getLibraryProject(id);
    if (!project) return;
    downloadTtml(project);
  }, []);

  const exportProjectJson = useCallback(async (id: string) => {
    if (id === useProjectStore.getState().activeProjectId) {
      await flushPendingSave();
    }
    const project = await getLibraryProject(id);
    if (!project) return;
    const audioFileName = project.audioSource?.kind === "file" ? project.audioSource.name : undefined;
    exportProjectToFile(
      project.metadata,
      project.agents,
      project.lines,
      project.groups,
      project.granularity,
      project.syllableSplitDefaults,
      project.dismissedSuggestions,
      project.dismissedExplicitSuggestions,
      audioFileName,
    );
  }, []);

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      const ok = await confirm({
        title: "Delete this project?",
        description: "This removes the project and its audio from your library. Cmd+Z does not bring it back.",
        variant: "destructive",
        confirmLabel: "Delete",
        recoverable: false,
      });
      if (!ok) return false;

      await deleteLibraryProject(id);
      await audioBlobs.delete(id);

      if (id === useProjectStore.getState().activeProjectId) {
        await useProjectStore.getState().setActiveProject(undefined);
        useUIStore.getState().setViewingLibrary(true);
      }

      await invalidate();
      return true;
    },
    [confirm, invalidate],
  );

  return {
    rename,
    duplicate,
    togglePin,
    evictAudio,
    exportTtml,
    exportProjectJson,
    delete: deleteProject,
  };
}

// -- Exports ------------------------------------------------------------------

export { useLibraryActions };
export type { LibraryActionsApi };
