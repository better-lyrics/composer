import type { TimingGranularity } from "@/domain/project/timing-granularity";
import { LyricsCode } from "@/ui/lyrics-code/lyrics-code";
import { Scroll } from "@/ui/scroll";
import { TtmlConflictNotice } from "@/views/export/ttml-conflict-notice";
import { TtmlEditor } from "@/views/export/ttml-editor";

// -- Types --------------------------------------------------------------------

interface ExportCodePaneProps {
  content: string;
  generatedTtml: string;
  fileName: string;
  exportTiming: TimingGranularity;
  isEditing: boolean;
  hasConflict: boolean;
  onEditContent: (content: string) => void;
  onRegenerate: () => void;
  onKeepEdits: () => void;
}

// -- Components ---------------------------------------------------------------

const FileHead: React.FC<{ fileName: string; content: string; exportTiming: TimingGranularity }> = ({
  fileName,
  content,
  exportTiming,
}) => (
  <div className="flex h-7 min-w-0 items-center justify-between gap-3 flex-1 select-none">
    <span className="truncate text-[13px] font-medium text-(--label)">{fileName}</span>
    <span className="shrink-0 font-mono text-xs text-(--muted)">
      {content.split("\n").length} lines ・ {exportTiming === "line" ? "Line" : "Word"} timing
    </span>
  </div>
);

const ExportCodePane: React.FC<ExportCodePaneProps> = ({
  content,
  generatedTtml,
  fileName,
  exportTiming,
  isEditing,
  hasConflict,
  onEditContent,
  onRegenerate,
  onKeepEdits,
}) => {
  const head = <FileHead fileName={fileName} content={content} exportTiming={exportTiming} />;
  return (
    <div className="flex flex-col gap-3.5 min-h-0 min-w-0 pt-3.5 px-4 pb-4">
      {hasConflict && <TtmlConflictNotice onRegenerate={onRegenerate} onKeepEdits={onKeepEdits} />}
      {isEditing ? (
        <TtmlEditor value={content} generatedTtml={generatedTtml} onChange={onEditContent} head={head} />
      ) : (
        <>
          <div className="flex h-7 shrink-0">{head}</div>
          <Scroll className="flex-1 min-h-0 rounded-xl bg-(--well) border border-(--edge)">
            <LyricsCode
              code={content}
              format="ttml"
              className="px-4 py-3.5 m-0 font-mono text-xs font-medium leading-5 whitespace-pre-wrap break-all select-text border-0! bg-transparent! rounded-none!"
            />
          </Scroll>
        </>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ExportCodePane };
