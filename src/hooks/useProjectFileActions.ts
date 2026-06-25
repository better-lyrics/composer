import { clearCurrentProject, exportProjectToFile, importProjectFromFile } from "@/lib/persistence";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/stores/project/types";
import { useCallback } from "react";

// -- Hook ---------------------------------------------------------------------

function useProjectFileActions(fileInputRef: React.RefObject<HTMLInputElement | null>) {
  const metadata = useProjectStore((s) => s.metadata);
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const granularity = useProjectStore((s) => s.granularity);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const setLines = useProjectStore((s) => s.setLines);
  const setGranularity = useProjectStore((s) => s.setGranularity);
  const setAgents = useProjectStore((s) => s.setAgents);
  const reset = useProjectStore((s) => s.reset);
  const markClean = useProjectStore((s) => s.markClean);
  const confirm = useConfirm();

  const handleExportProject = useCallback(() => {
    const audioSource = useAudioStore.getState().source;
    const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
    const { dismissedSuggestions, dismissedExplicitSuggestions, syllableSplitDefaults, customSnapPoints } =
      useProjectStore.getState();
    exportProjectToFile(
      metadata,
      agents,
      lines,
      groups,
      granularity,
      syllableSplitDefaults,
      dismissedSuggestions,
      dismissedExplicitSuggestions,
      customSnapPoints,
      audioFileName,
    );
  }, [metadata, agents, lines, groups, granularity]);

  const handleImportProject = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const existingLineCount = useProjectStore.getState().lines.length;
      if (existingLineCount > 0) {
        const ok = await confirm({
          title: "Replace current project?",
          description: `Loading this project file will replace your ${existingLineCount} existing line${existingLineCount === 1 ? "" : "s"} and metadata. This cannot be undone.`,
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
      const store = useProjectStore.getState();
      setMetadata(project.metadata);
      setLines(project.lines);
      store.setGroups(project.groups ?? []);
      store.setDismissedSuggestions(project.dismissedSuggestions ?? []);
      store.setDismissedExplicitSuggestions(project.dismissedExplicitSuggestions ?? []);
      setGranularity(project.granularity);
      store.setSyllableSplitDefaults(project.syllableSplitDefaults ?? DEFAULT_SYLLABLE_SPLIT_DEFAULTS);
      setAgents(project.agents);
      store.setCustomSnapPoints(project.customSnapPoints ?? []);
      markClean();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [setMetadata, setLines, setGranularity, setAgents, markClean, confirm, fileInputRef],
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
