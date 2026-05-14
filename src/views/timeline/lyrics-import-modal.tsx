import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { textToLyricLines } from "@/utils/lyrics-text";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { IconFileImport, IconUpload } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface LyricsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// -- Component ----------------------------------------------------------------

const LyricsImportModal: React.FC<LyricsImportModalProps> = ({ isOpen, onClose }) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setLines = useProjectStore((s) => s.setLines);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const addAgent = useProjectStore((s) => s.addAgent);
  const agents = useProjectStore((s) => s.agents);
  const duration = useAudioStore((s) => s.duration);
  const confirm = useConfirm();

  const confirmReplaceIfNeeded = useCallback(async () => {
    const existingLineCount = useProjectStore.getState().lines.length;
    if (existingLineCount === 0) return true;
    return confirm({
      title: "Replace existing lyrics?",
      description: `This will replace your ${existingLineCount} existing line${existingLineCount === 1 ? "" : "s"}. This cannot be undone.`,
      confirmLabel: "Replace",
      variant: "destructive",
      settingsKey: "confirmReplaceLyrics",
    });
  }, [confirm]);

  const handleConfirm = useCallback(async () => {
    if (!text.trim()) return;
    if (!(await confirmReplaceIfNeeded())) return;

    const defaultAgentId = agents[0]?.id ?? "v1";
    let lyricLines = textToLyricLines(text, defaultAgentId);

    if (duration > 0) {
      lyricLines = distributeLinesTiming(lyricLines, duration);
    }

    setLines(lyricLines);
    setText("");
    onClose();
  }, [text, agents, duration, setLines, onClose, confirmReplaceIfNeeded]);

  const handleFileImport = useCallback(
    async (file: File) => {
      const content = await file.text();
      const result = parseLyricsFile(file.name, content);

      if (result.lines.length > 0) {
        if (!(await confirmReplaceIfNeeded())) return;

        let importedLines = result.lines;

        if (result.agents?.length) {
          const updateAgent = useProjectStore.getState().updateAgent;
          for (const agent of result.agents) {
            const existing = agents.find((a) => a.id === agent.id);
            if (existing) {
              updateAgent(agent.id, { name: agent.name, type: agent.type });
            } else {
              addAgent(agent);
            }
          }
        }

        if (Object.keys(result.metadata).length > 0) {
          setMetadata(result.metadata);
        }

        if (duration > 0 && !result.hasTimingData) {
          importedLines = distributeLinesTiming(importedLines, duration);
        }

        setLines(importedLines);
        useProjectStore.getState().setGroups(result.groups ?? []);
        setText("");
        onClose();
      }
    },
    [agents, duration, setLines, setMetadata, addAgent, onClose, confirmReplaceIfNeeded],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileImport(file);
      e.target.value = "";
    },
    [handleFileImport],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && /\.(txt|lrc|srt|ttml|xml)$/i.test(file.name)) {
        handleFileImport(file);
      }
    },
    [handleFileImport],
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const lineCount = text.split("\n").filter((l) => l.trim() !== "").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Lyrics" className="max-w-lg" initialFocusRef={textareaRef}>
      <div className="flex flex-col gap-4" onDrop={handleDrop} onDragOver={handleDragOver}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Paste lyrics here, one line per line...

Use | to split syllables (e.g. beau|ti|ful)"
          className="h-48 p-3 text-sm border rounded-lg resize-none bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent placeholder:text-composer-text-muted"
          spellCheck={false}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" hasIcon onClick={() => fileInputRef.current?.click()}>
              <IconUpload size={16} />
              Import file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.lrc,.srt,.ttml,.xml"
              onChange={handleFileInputChange}
              className="sr-only"
            />
            <span className="text-xs text-composer-text-muted">.txt .lrc .srt .ttml</span>
          </div>

          {lineCount > 0 && (
            <span className="text-xs text-composer-text-muted">
              {lineCount} line{lineCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!text.trim()} hasIcon>
            <IconFileImport size={16} />
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsImportModal };
