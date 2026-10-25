import { useExportTtml } from "@/hooks/use-export-ttml";
import { downloadText, sanitizeFileName } from "@/lib/download-file";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";
import { applyEditsToProject } from "@/views/export/apply-edits-feedback";
import { ExportCodePane } from "@/views/export/export-code-pane";
import { ExportHeader } from "@/views/export/export-header";
import { MetadataPanel } from "@/views/export/metadata-panel";
import { useProjectFileInput } from "@/views/export/project-menu-button";
import { keptTtmlEdit, typedTtmlEdit } from "@/views/export/ttml-edit-state";
import { IconFolderOpen } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface EditingSession {
  projectSession: number;
  startContent: string;
}

// -- Components ---------------------------------------------------------------

const ExportPanel: React.FC = () => {
  const {
    content: exportContent,
    duration,
    editedContent,
    editBlocksLineTiming,
    exportTiming,
    generatedContent: generatedTtml,
    hasConflict,
    lineCount,
    setEditState,
    setExportTiming,
    syncedLineCount,
    title,
    youtubeVideoId,
  } = useExportTtml();

  const projectSession = useProjectStore((state) => state.projectSession);
  const [copied, setCopied] = useState(false);
  const [editingSession, setEditingSession] = useState<EditingSession | null>(null);
  const session = editingSession?.projectSession === projectSession ? editingSession : null;
  const isEditing = session !== null;
  const projectFile = useProjectFileInput();

  const hasSyncedContent = syncedLineCount > 0;
  const fileName = `${sanitizeFileName(title, "lyrics")}.ttml`;

  const isExportable = useCallback(() => {
    if (editedContent === null) return true;
    const validation = validateTtml(editedContent);
    if (validation.ok) return true;
    toast.error(`The TTML has an XML error: ${validation.message}`);
    return false;
  }, [editedContent]);

  const handleDownload = useCallback(() => {
    if (!exportContent || !isExportable()) return;

    downloadText(exportContent, fileName, "application/ttml+xml;charset=utf-8");
    useProjectStore.getState().clearUnexportedImport();
  }, [exportContent, isExportable, fileName]);

  const handleCopy = useCallback(async () => {
    if (!exportContent || !isExportable()) return;

    await navigator.clipboard.writeText(exportContent);
    useProjectStore.getState().clearUnexportedImport();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent, isExportable]);

  const handleEdit = useCallback(() => {
    if (!session) {
      setEditingSession({ projectSession, startContent: exportContent });
      return;
    }
    const changedThisSession = editedContent !== null && editedContent !== session.startContent;
    if (changedThisSession && !hasConflict) applyEditsToProject(editedContent, duration, youtubeVideoId);
    setEditingSession(null);
  }, [session, projectSession, exportContent, editedContent, hasConflict, duration, youtubeVideoId]);

  const handleRegenerate = useCallback(() => {
    setEditState(null);
    setEditingSession(null);
  }, [setEditState]);

  // Resolving a conflict rebases the edit onto the current output, which is what
  // makes the notice go away. It has to be a deliberate action: letting an
  // incidental keystroke do it would silently drop the regenerated changes.
  const handleKeepEdits = useCallback(() => {
    setEditState((prev) => keptTtmlEdit(prev, generatedTtml));
  }, [generatedTtml, setEditState]);

  const handleEditContent = useCallback(
    (content: string) => {
      setEditState((prev) => typedTtmlEdit(prev, generatedTtml, content, hasConflict));
    },
    [generatedTtml, hasConflict, setEditState],
  );

  const importAction = (
    <>
      {projectFile.input}
      <Button hasIcon variant="secondary" onClick={projectFile.pickFile} className="mt-2">
        <IconFolderOpen className="size-4 text-composer-text opacity-50" />
        Import project
      </Button>
    </>
  );

  if (lineCount === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to export" hint="Add lyrics in the Edit tab first" action={importAction} />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" action={importAction} />
      </div>
    );
  }

  return (
    <div data-tour="export-panel" className="flex flex-col flex-1 overflow-hidden">
      <ExportHeader
        syncedLineCount={syncedLineCount}
        lineCount={lineCount}
        isEdited={editedContent !== null}
        isEditing={isEditing}
        copied={copied}
        exportTiming={exportTiming}
        lineTimingLocked={isEditing || editBlocksLineTiming}
        onExportTimingChange={setExportTiming}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onCopy={handleCopy}
        onDownload={handleDownload}
      />
      <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_380px] grid-rows-[minmax(0,1fr)]">
        <ExportCodePane
          content={exportContent}
          generatedTtml={generatedTtml}
          fileName={fileName}
          exportTiming={exportTiming}
          isEditing={isEditing}
          hasConflict={hasConflict}
          onEditContent={handleEditContent}
          onRegenerate={handleRegenerate}
          onKeepEdits={handleKeepEdits}
        />
        <MetadataPanel />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportPanel };
