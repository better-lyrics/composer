import { applySavedProject } from "@/lib/apply-saved-project";
import { clearCurrentProject, exportProjectToFile, importProjectFromFile } from "@/lib/persistence";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { pluralize } from "@/utils/pluralize";
import { useCallback } from "react";

// -- Hook ---------------------------------------------------------------------

function useProjectFileActions(fileInputRef: React.RefObject<HTMLInputElement | null>) {
  const reset = useProjectStore((s) => s.reset);
  const confirm = useConfirm();

  const handleExportProject = useCallback(() => {
    const audioSource = useAudioStore.getState().source;
    const state = useProjectStore.getState();
    exportProjectToFile({
      metadata: state.metadata,
      agents: state.agents,
      lines: state.lines,
      groups: state.groups,
      granularity: state.granularity,
      syllableSplitDefaults: state.syllableSplitDefaults,
      dismissedSuggestions: state.dismissedSuggestions,
      dismissedExplicitSuggestions: state.dismissedExplicitSuggestions,
      customSnapPoints: state.customSnapPoints,
      importedMetadataKeys: state.importedMetadataKeys,
      ttmlEditState: state.ttmlEditState,
      audioFileName: audioSource?.type === "file" ? audioSource.file.name : undefined,
    });
  }, []);

  const handleImportProject = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const existingLineCount = useProjectStore.getState().lines.length;
      if (existingLineCount > 0) {
        const ok = await confirm({
          title: "Replace current project?",
          description: `Loading this project file will replace your ${pluralize(existingLineCount, "existing line")} and metadata. This cannot be undone.`,
          confirmLabel: "Replace",
          variant: "destructive",
          settingsKey: "confirmReplaceLyrics",
        });
        if (!ok) {
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      const project = await importProjectFromFile(file);
      useProjectStore.getState().startProjectSession();
      applySavedProject(project, "file");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [confirm, fileInputRef],
  );

  const handleClearProject = useCallback(async () => {
    const ok = await confirm({
      title: "Clear all project data?",
      description: "Remove every line, all metadata, and the audio file from this project. This cannot be undone.",
      confirmLabel: "Clear",
      variant: "destructive",
      settingsKey: "confirmClearProject",
    });
    if (!ok) return;
    cancelPendingSave();
    reset();
    await clearCurrentProject();
  }, [reset, confirm]);

  return { handleExportProject, handleImportProject, handleClearProject };
}

// -- Exports ------------------------------------------------------------------

export { useProjectFileActions };
