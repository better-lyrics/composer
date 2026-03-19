import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { textToLyricLines } from "@/utils/lyrics-text";
import { distributeLinesTiming } from "@/views/timeline/utils";
import { IconFileImport, IconUpload } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);
  const setLines = useProjectStore((s) => s.setLines);
  const setMetadata = useProjectStore((s) => s.setMetadata);
  const addAgent = useProjectStore((s) => s.addAgent);
  const agents = useProjectStore((s) => s.agents);
  const duration = useAudioStore((s) => s.duration);

  const handleConfirm = useCallback(() => {
    if (!text.trim()) return;
    const defaultAgentId = agents[0]?.id ?? "v1";
    let lyricLines = textToLyricLines(text, defaultAgentId);

    if (duration > 0) {
      lyricLines = distributeLinesTiming(lyricLines, duration);
    }

    setLines(lyricLines);
    setText("");
    onClose();
  }, [text, agents, duration, setLines, onClose]);

  const handleFileImport = useCallback(
    async (file: File) => {
      const content = await file.text();
      const result = parseLyricsFile(file.name, content);

      if (result.lines.length > 0) {
        let importedLines = result.lines;

        if (result.agents?.length) {
          for (const agent of result.agents) {
            if (!agents.find((a) => a.id === agent.id)) {
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
        setText("");
        onClose();
      }
    },
    [agents, duration, setLines, setMetadata, addAgent, onClose],
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
    <Modal isOpen={isOpen} onClose={onClose} title="Import Lyrics" className="max-w-lg">
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
