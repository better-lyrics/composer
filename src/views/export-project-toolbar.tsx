import { IconFolderOpen, IconTrash, IconUpload } from "@tabler/icons-react";
import { useCallback } from "react";
import { useInvalidateLibraryProjects } from "@/hooks/useLibraryProjects";
import { audioBlobs } from "@/lib/audio-blob-store-singleton";
import { deleteLibraryProject } from "@/lib/library-persistence";
import { exportProjectToFile } from "@/lib/persistence";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/ui/button";

// -- Interfaces ---------------------------------------------------------------

interface ExportProjectToolbarProps {
  onImportClick: () => void;
}

// -- Component ----------------------------------------------------------------

const ExportProjectToolbar: React.FC<ExportProjectToolbarProps> = ({ onImportClick }) => {
  const confirm = useConfirm();
  const invalidateLibrary = useInvalidateLibraryProjects();

  const handleExport = useCallback(() => {
    const p = useProjectStore.getState();
    const audioSource = useAudioStore.getState().source;
    const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
    exportProjectToFile(
      p.metadata,
      p.agents,
      p.lines,
      p.groups,
      p.granularity,
      p.syllableSplitDefaults,
      p.dismissedSuggestions,
      p.dismissedExplicitSuggestions,
      audioFileName,
    );
  }, []);

  const handleClear = useCallback(async () => {
    const ok = await confirm({
      title: "Clear all project data?",
      description: "Remove every line, all metadata, and the audio file from this project. This cannot be undone.",
      confirmLabel: "Clear",
      variant: "destructive",
      settingsKey: "confirmClearProject",
    });
    if (!ok) return;
    cancelPendingSave();
    const activeId = useProjectStore.getState().activeProjectId;
    if (activeId) {
      await deleteLibraryProject(activeId);
      await audioBlobs.delete(activeId);
    }
    await useProjectStore.getState().setActiveProject(undefined);
    useUIStore.getState().setViewingLibrary(true);
    await invalidateLibrary();
  }, [confirm, invalidateLibrary]);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border bg-composer-bg-elevated/50">
      <span className="text-sm text-composer-text-muted">Project</span>
      <div className="flex items-center gap-2">
        <Button hasIcon variant="ghost" size="sm" onClick={onImportClick}>
          <IconFolderOpen className="size-4 text-composer-text opacity-50" />
          Import Project
        </Button>
        <Button hasIcon variant="ghost" size="sm" onClick={handleExport}>
          <IconUpload className="size-4 text-composer-text opacity-50" />
          Export Project
        </Button>
        <Button hasIcon variant="ghost" size="sm" onClick={handleClear}>
          <IconTrash className="size-4 text-composer-text opacity-50" />
          Clear
        </Button>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportProjectToolbar };
