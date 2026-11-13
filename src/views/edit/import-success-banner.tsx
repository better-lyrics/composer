import { IconFileImport, IconX } from "@tabler/icons-react";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { IconButton } from "@/ui/icon-button";
import type { ParseResult } from "@/utils/lyrics-parsers";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

interface ImportSuccessBannerProps {
  result: ParseResult;
  filename: string;
  onDismiss: () => void;
}

// -- Component ----------------------------------------------------------------

const ImportSuccessBanner: React.FC<ImportSuccessBannerProps> = ({ result, filename, onDismiss }) => {
  const lineCount = result.lines.length;
  const timedLineCount = result.lines.filter((l) => mainTrack(l).begin !== undefined).length;
  const wordTimedCount = result.lines.filter((l) => timedSyllables(mainTrack(l)).length > 0).length;

  return (
    <div className="flex items-center justify-between gap-2 h-9 pl-3 pr-1 text-[13px] rounded-xl bg-composer-accent/10 text-composer-accent-text">
      <div className="flex items-center gap-2">
        <IconFileImport className="size-4 shrink-0" />
        <span>
          Imported {pluralize(lineCount, "line")} from {filename}
          {result.hasTimingData && (
            <>
              {" "}
              with{" "}
              {wordTimedCount > 0
                ? pluralize(wordTimedCount, "word-timed line")
                : pluralize(timedLineCount, "timed line")}
            </>
          )}
        </span>
      </div>
      <IconButton
        label="Dismiss"
        icon={<IconX className="size-4" />}
        variant="ghost"
        onClick={onDismiss}
        className="size-7 hover:bg-(--layer-2)"
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ImportSuccessBanner };
