import { useExportTtml } from "@/hooks/use-export-ttml";
import { useProjectFileActions } from "@/hooks/useProjectFileActions";
import { downloadText, sanitizeFileName } from "@/lib/download-file";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import { useProjectStore } from "@/stores/project";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Scroll } from "@/ui/scroll";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";
import { codeHighlightThemeFor } from "@/utils/theme/code-highlight-theme";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { MetadataPanel } from "@/views/export/metadata-panel";
import { TtmlConflictNotice } from "@/views/export/ttml-conflict-notice";
import { TtmlEditor } from "@/views/export/ttml-editor";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFolderOpen,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { Highlight } from "prism-react-renderer";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const APPLIED_MESSAGE = "Updated the lyrics from the TTML";
const KEPT_IN_EXPORT_MESSAGE = "Updated the lyrics from the TTML. Some edits only change the exported file.";
const EXPORT_ONLY_MESSAGE = "The lyrics stay as they were, so your edits only change the exported file.";
const NOT_SYNCED_MESSAGE =
  "Your edits only change the exported file. Sync every line to let Done apply them to the lyrics.";

// -- Helpers ------------------------------------------------------------------

function applyEditsToProject(content: string, duration: number): void {
  const result = applyEditedTtml(content, duration);
  if (result.status === "export-only") {
    toast(NOT_SYNCED_MESSAGE);
    return;
  }
  if (result.status === "unreadable") {
    toast.error(`${result.message} ${EXPORT_ONLY_MESSAGE}`);
    return;
  }
  toast(result.keptInExport ? KEPT_IN_EXPORT_MESSAGE : APPLIED_MESSAGE);
  if (result.skipped > 0) toast.warning(skippedLinesMessage(result.skipped));
}

// -- Components ---------------------------------------------------------------

const ExportPanel: React.FC = () => {
  const scheme = useThemeStore((s) => s.getThemeById(s.activeThemeId)?.scheme ?? "dark");
  const {
    content: exportContent,
    duration,
    editedContent,
    generatedContent: generatedTtml,
    hasConflict,
    lineCount,
    setEditState,
    syncedLineCount,
    title,
  } = useExportTtml();

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sessionStartContent, setSessionStartContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleExportProject, handleImportProject, handleClearProject } = useProjectFileActions();

  const hasSyncedContent = syncedLineCount > 0;

  const isExportable = useCallback(() => {
    if (editedContent === null) return true;
    const validation = validateTtml(editedContent);
    if (validation.ok) return true;
    toast.error(`The TTML has an XML error: ${validation.message}`);
    return false;
  }, [editedContent]);

  const handleDownload = useCallback(() => {
    if (!exportContent || !isExportable()) return;

    downloadText(exportContent, `${sanitizeFileName(title, "lyrics")}.ttml`, "application/ttml+xml;charset=utf-8");
    useProjectStore.getState().clearUnexportedImport();
  }, [exportContent, isExportable, title]);

  const handleCopy = useCallback(async () => {
    if (!exportContent || !isExportable()) return;

    await navigator.clipboard.writeText(exportContent);
    useProjectStore.getState().clearUnexportedImport();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent, isExportable]);

  const handleEdit = useCallback(() => {
    if (!isEditing) {
      setSessionStartContent(exportContent);
      setIsEditing(true);
      return;
    }
    const changedThisSession = editedContent !== null && editedContent !== sessionStartContent;
    if (changedThisSession && !hasConflict) applyEditsToProject(editedContent, duration);
    setIsEditing(false);
  }, [isEditing, exportContent, editedContent, sessionStartContent, hasConflict, duration]);

  const handleRegenerate = useCallback(() => {
    setEditState(null);
    setIsEditing(false);
  }, [setEditState]);

  // Resolving a conflict rebases the edit onto the current output, which is what
  // makes the notice go away. It has to be a deliberate action: letting an
  // incidental keystroke do it would silently drop the regenerated changes.
  const handleKeepEdits = useCallback(() => {
    setEditState((prev) => (prev === null ? prev : { source: generatedTtml, content: prev.content }));
  }, [generatedTtml, setEditState]);

  const handleEditContent = useCallback(
    (content: string) => {
      setEditState((prev) => {
        if (prev !== null && hasConflict) return { ...prev, content };
        return { source: generatedTtml, content };
      });
    },
    [generatedTtml, hasConflict, setEditState],
  );

  const projectFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      aria-label="Import project file"
      accept={PROJECT_FILE_ACCEPT}
      onChange={handleImportProject}
      className="hidden"
    />
  );
  const importAction = (
    <>
      {projectFileInput}
      <Button hasIcon variant="secondary" onClick={() => fileInputRef.current?.click()} className="mt-2">
        <IconFolderOpen className="size-4 text-composer-text opacity-50" />
        Import Project
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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-medium">Export</h2>
          <span className="text-sm text-composer-text-muted">
            {syncedLineCount}/{lineCount} lines synced
            {editedContent !== null && " · edited"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editedContent !== null && (
            <Button hasIcon onClick={handleRegenerate}>
              <IconRefresh className="size-4" />
              Regenerate
            </Button>
          )}
          <Button hasIcon variant={isEditing ? "primary" : "secondary"} onClick={handleEdit}>
            <IconEdit className="size-4" />
            {isEditing ? "Done" : "Edit"}
          </Button>
          <Button hasIcon onClick={handleCopy}>
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button hasIcon variant="primary" onClick={handleDownload}>
            <IconDownload className="size-4" />
            Download TTML
          </Button>
        </div>
      </div>

      {/* Project management */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border bg-composer-bg-elevated/50">
        <span className="text-sm text-composer-text-muted">Project</span>
        <div className="flex items-center gap-2">
          {projectFileInput}
          <Button hasIcon variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <IconFolderOpen className="size-4 text-composer-text opacity-50" />
            Import Project
          </Button>
          <Button hasIcon variant="ghost" size="sm" onClick={handleExportProject}>
            <IconUpload className="size-4 text-composer-text opacity-50" />
            Export Project
          </Button>
          <Button hasIcon variant="ghost" size="sm" onClick={handleClearProject}>
            <IconTrash className="size-4 text-composer-text opacity-50" />
            Clear
          </Button>
        </div>
      </div>

      <MetadataPanel />

      {hasConflict && <TtmlConflictNotice onRegenerate={handleRegenerate} onKeepEdits={handleKeepEdits} />}

      {/* Preview / Editor */}
      {isEditing ? (
        <TtmlEditor value={exportContent} generatedTtml={generatedTtml} onChange={handleEditContent} />
      ) : (
        <Scroll className="flex-1 p-6">
          <Highlight theme={codeHighlightThemeFor(scheme)} code={exportContent} language="xml">
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre className="p-4 rounded-lg font-mono text-xs whitespace-pre-wrap break-all select-text" style={style}>
                {tokens.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable line indices
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable token indices
                      <span key={j} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </Scroll>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportPanel };
