import { IconButton } from "@/ui/icon-button";
import type { ParseResult } from "@/utils/lyrics-parsers";
import { pluralize } from "@/utils/pluralize";
import { IconFileImport, IconX } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface ImportSuccessBannerProps {
  result: ParseResult;
  filename: string;
  onDismiss: () => void;
}

// -- Component ----------------------------------------------------------------

const ImportSuccessBanner: React.FC<ImportSuccessBannerProps> = ({ result, filename, onDismiss }) => {
  const lineCount = result.lines.length;
  const timedLineCount = result.lines.filter((l) => l.begin !== undefined).length;
  const wordTimedCount = result.lines.filter((l) => l.words?.length).length;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-composer-accent/10 text-composer-accent-text">
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
        className="size-6"
      />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ImportSuccessBanner };
