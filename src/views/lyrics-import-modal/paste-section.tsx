import { LYRICS_FORMATS_PROSE } from "@/domain/lyrics-file/supported-formats";
import { Button } from "@/ui/button";
import { LyricsCodeEditor } from "@/ui/lyrics-code/lyrics-code-editor";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { PROJECT_FILE_PROSE } from "@/views/lyrics-import-modal/accepted-files";
import { IconArrowLeft, IconUpload } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface PasteSectionProps {
  value: string;
  onChange: (text: string) => void;
  onSwitchToSearch: () => void;
  onSwitchToUpload: () => void;
}

// -- Helpers ------------------------------------------------------------------

const focusOnMount: React.RefCallback<HTMLTextAreaElement> = (el) => {
  el?.focus();
};

function countNonEmptyLines(text: string): number {
  if (text === "") return 0;
  let count = 0;
  for (const line of text.split("\n")) {
    if (line.trim() !== "") count++;
  }
  return count;
}

// -- Constants ----------------------------------------------------------------

const PASTE_PLACEHOLDER = `Paste lyrics here, one line per line. Use | to split syllables. A whole ${LYRICS_FORMATS_PROSE} file works too, and so does ${PROJECT_FILE_PROSE}.`;

// -- Component ----------------------------------------------------------------

const PasteSection: React.FC<PasteSectionProps> = ({ value, onChange, onSwitchToSearch, onSwitchToUpload }) => {
  const lineCount = countNonEmptyLines(value);

  return (
    <div className={cn("flex flex-col gap-2.5 p-3 rounded-lg", "bg-composer-input border border-composer-border")}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" hasIcon onClick={onSwitchToSearch}>
          <IconArrowLeft size={14} stroke={2} />
          Back to search
        </Button>
        <button
          type="button"
          onClick={onSwitchToUpload}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer bg-transparent border-none px-1 py-0.5 rounded text-composer-text-secondary hover:text-composer-text transition-colors"
        >
          <IconUpload size={12} stroke={2} className="text-composer-text opacity-60" />
          Upload file instead
        </button>
      </div>
      <LyricsCodeEditor
        ref={focusOnMount}
        aria-label="Lyrics text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={PASTE_PLACEHOLDER}
        spellCheck={false}
        frameClassName="h-32"
        className="p-3 font-mono text-sm focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-composer-text-muted">
          Use{" "}
          <code className="font-mono text-[10.5px] px-1 py-px rounded bg-composer-input-hover text-composer-text-secondary">
            |
          </code>{" "}
          to split syllables (e.g. beau|ti|ful)
        </span>
        {lineCount > 0 && (
          <span className="text-xs text-composer-text-muted select-text">{pluralize(lineCount, "line")}</span>
        )}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PasteSection };
