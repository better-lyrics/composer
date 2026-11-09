import { IconFolderOpen } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useExportTtml } from "@/hooks/use-export-ttml";
import { useUnisonFeatures } from "@/hooks/unison/useUnisonFeatures";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import { downloadText, sanitizeFileName } from "@/lib/download-file";
import { outgoingTtml } from "@/lib/outgoing-ttml";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";
import { noteGuideExport, noteGuideSignal } from "@/lib/guide-signals";
import { AlignmentReviewNotice } from "@/views/export/alignment-review-notice";
import { UntimedLinesNotice } from "@/views/export/untimed-lines-notice";
import { applyEditsToProject } from "@/views/export/apply-edits-feedback";
import { ExportCodePane } from "@/views/export/export-code-pane";
import { ExportHeader } from "@/views/export/export-header";
import { ExportSidePanel } from "@/views/export/export-side-panel";
import { useProjectFileInput } from "@/views/export/project-menu-button";
import { keptTtmlEdit, typedTtmlEdit } from "@/views/export/ttml-edit-state";
import type { UnisonExportSource } from "@/views/export/unison/submit-card-shell";
import { UnisonPanel } from "@/views/export/unison/unison-panel";
import { useAlignmentReview } from "@/views/export/use-alignment-review";

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
  const unisonEnabled = useUnisonFeatures().enabled;
  const signedInToUnison = useUnisonSession() !== null && unisonEnabled;
  const [copied, setCopied] = useState(false);
  const [editingSession, setEditingSession] = useState<EditingSession | null>(null);
  const session = editingSession?.projectSession === projectSession ? editingSession : null;
  const isEditing = session !== null;
  const projectFile = useProjectFileInput();
  const alignment = useAlignmentReview();

  const hasSyncedContent = syncedLineCount > 0;
  const fileName = `${sanitizeFileName(title, "lyrics")}.ttml`;

  const isExportable = useCallback(() => {
    if (editedContent === null) return true;
    const validation = validateTtml(editedContent);
    if (validation.ok) return true;
    toast.error(`The TTML has an XML error: ${validation.message}`);
    return false;
  }, [editedContent]);

  const outgoingContent = useCallback(
    () => outgoingTtml({ editedContent, generatedContent: generatedTtml, duration, exportTiming, youtubeVideoId }),
    [editedContent, generatedTtml, duration, exportTiming, youtubeVideoId],
  );

  const handleDownload = useCallback(async () => {
    if (!exportContent || !isExportable()) return;
    if (!(await alignment.confirmExport("download"))) return;

    downloadText(outgoingContent(), fileName, "application/ttml+xml;charset=utf-8");
    useProjectStore.getState().clearUnexportedImport();
    noteGuideExport();
  }, [exportContent, isExportable, fileName, alignment.confirmExport, outgoingContent]);

  const handleCopy = useCallback(async () => {
    if (!exportContent || !isExportable()) return;
    if (!(await alignment.confirmExport("copy"))) return;

    await navigator.clipboard.writeText(outgoingContent());
    useProjectStore.getState().clearUnexportedImport();
    noteGuideExport();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent, isExportable, alignment.confirmExport, outgoingContent]);

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

  const unisonSource = useMemo(
    (): UnisonExportSource => ({
      content: exportContent && outgoingContent(),
      isEdited: editedContent !== null,
      videoId: youtubeVideoId,
      durationSeconds: duration,
      lineCount,
      syncedLineCount,
      review: alignment.review,
      reviewInTimeline: alignment.reviewInTimeline,
      regenerate: handleRegenerate,
    }),
    [
      exportContent,
      outgoingContent,
      editedContent,
      youtubeVideoId,
      duration,
      lineCount,
      syncedLineCount,
      alignment.review,
      alignment.reviewInTimeline,
      handleRegenerate,
    ],
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
        onExportTimingChange={(timing) => {
          setExportTiming(timing);
          noteGuideSignal("export.timing");
        }}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onCopy={handleCopy}
        onDownload={handleDownload}
        downloadIsPrimary={!signedInToUnison}
      />
      <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_400px] grid-rows-[minmax(0,1fr)]">
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
          notice={
            <>
              <UntimedLinesNotice />
              <AlignmentReviewNotice
                notice={alignment.notice}
                review={alignment.review}
                onReview={alignment.reviewInTimeline}
                onDismiss={alignment.dismiss}
              />
            </>
          }
        />
        <ExportSidePanel unison={unisonEnabled && <UnisonPanel source={unisonSource} />} />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportPanel };
