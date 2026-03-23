import { exportProjectToFile, importProjectFromFile, clearCurrentProject, cancelPendingSave } from "@/lib/persistence";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { getLineTiming } from "@/utils/sync-helpers";
import { generateTTML } from "@/utils/ttml";
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
import { Highlight, themes } from "prism-react-renderer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Components ---------------------------------------------------------------

const ExportPanel: React.FC = () => {
  const metadata = useProjectStore((s) => s.metadata);
  const agents = useProjectStore((s) => s.agents);
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const duration = useAudioStore((s) => s.duration);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const setLines = useProjectStore((s) => s.setLines);
  const setGranularity = useProjectStore((s) => s.setGranularity);
  const addAgent = useProjectStore((s) => s.addAgent);
  const reset = useProjectStore((s) => s.reset);
  const markClean = useProjectStore((s) => s.markClean);

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSyncedContent = useMemo(() => {
    return lines.some((line) => getLineTiming(line) !== null);
  }, [lines]);

  const syncedLineCount = useMemo(() => {
    return lines.filter((line) => getLineTiming(line) !== null).length;
  }, [lines]);

  const generatedTtml = useMemo(() => {
    if (!hasSyncedContent) return "";
    return generateTTML({ metadata, agents, lines, granularity, duration });
  }, [metadata, agents, lines, granularity, duration, hasSyncedContent]);

  const minifiedTtml = useMemo(() => {
    if (!hasSyncedContent) return "";
    return generateTTML({ metadata, agents, lines, granularity, minify: true, duration });
  }, [metadata, agents, lines, granularity, duration, hasSyncedContent]);

  // Reset edited content when generated content changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when generated content changes
  useEffect(() => {
    setEditedContent(null);
    setIsEditing(false);
  }, [generatedTtml]);

  const displayContent = editedContent ?? generatedTtml;
  const exportContent = editedContent ?? minifiedTtml;

  const handleDownload = useCallback(() => {
    if (!exportContent) return;

    const blob = new Blob([exportContent], {
      type: "application/ttml+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metadata.title || "lyrics"}.ttml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportContent, metadata.title]);

  const handleCopy = useCallback(async () => {
    if (!exportContent) return;

    await navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportContent]);

  const handleEdit = useCallback(() => {
    if (!isEditing) {
      setEditedContent(displayContent);
    }
    setIsEditing(!isEditing);
  }, [isEditing, displayContent]);

  const handleRegenerate = useCallback(() => {
    setEditedContent(null);
    setIsEditing(false);
  }, []);

  const handleExportProject = useCallback(() => {
    const audioSource = useAudioStore.getState().source;
    const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
    exportProjectToFile(metadata, agents, lines, granularity, audioFileName);
  }, [metadata, agents, lines, granularity]);

  const handleImportProject = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const project = await importProjectFromFile(file);
      setMetadata(project.metadata);
      setLines(project.lines);
      setGranularity(project.granularity);
      for (const agent of project.agents) {
        if (!agents.find((a) => a.id === agent.id)) {
          addAgent(agent);
        }
      }
      markClean();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [agents, setMetadata, setLines, setGranularity, addAgent, markClean],
  );

  const handleClearProject = useCallback(async () => {
    if (!confirm("This will clear all project data. Are you sure?")) return;
    cancelPendingSave();
    reset();
    await clearCurrentProject();
  }, [reset]);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to export" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" />
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
            {syncedLineCount}/{lines.length} lines synced
            {editedContent !== null && " · edited"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editedContent !== null && (
            <Button hasIcon onClick={handleRegenerate}>
              <IconRefresh className="w-4 h-4" />
              Regenerate
            </Button>
          )}
          <Button hasIcon variant={isEditing ? "primary" : "secondary"} onClick={handleEdit}>
            <IconEdit className="w-4 h-4" />
            {isEditing ? "Done" : "Edit"}
          </Button>
          <Button hasIcon onClick={handleCopy}>
            {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button hasIcon variant="primary" onClick={handleDownload}>
            <IconDownload className="w-4 h-4" />
            Download TTML
          </Button>
        </div>
      </div>

      {/* Project management */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-composer-border bg-composer-bg-elevated/50">
        <span className="text-sm text-composer-text-muted">Project</span>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.ttml-project.json"
            onChange={handleImportProject}
            className="hidden"
          />
          <Button hasIcon variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <IconFolderOpen className="w-4 h-4 text-composer-text opacity-50" />
            Import Project
          </Button>
          <Button hasIcon variant="ghost" size="sm" onClick={handleExportProject}>
            <IconUpload className="w-4 h-4 text-composer-text opacity-50" />
            Export Project
          </Button>
          <Button hasIcon variant="ghost" size="sm" onClick={handleClearProject}>
            <IconTrash className="w-4 h-4 text-composer-text opacity-50" />
            Clear
          </Button>
        </div>
      </div>

      {/* Preview / Editor */}
      <div className="flex-1 overflow-auto p-6">
        {isEditing ? (
          <textarea
            value={editedContent ?? ""}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-full p-4 rounded-lg font-mono text-xs bg-composer-bg-elevated text-composer-text resize-none focus:outline-none focus:ring-1 focus:ring-composer-accent"
            spellCheck={false}
          />
        ) : (
          <Highlight theme={themes.nightOwl} code={displayContent} language="xml">
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className="p-4 rounded-lg font-mono text-xs whitespace-pre-wrap break-all select-text"
                style={{
                  ...style,
                  background: "var(--color-composer-bg-elevated)",
                }}
              >
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
        )}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportPanel };
