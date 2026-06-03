import { IconRefresh } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { LyricLine } from "@/domain/line/model";
import { generateForLine } from "@/domain/romanization/generate";
import { defaultSchemeForLang } from "@/domain/romanization/schemes";
import { detectNonLatinLanguage } from "@/domain/romanization/detect";
import { useProjectStore } from "@/stores/project";
import { toastBulkResult, toastError } from "@/utils/romanization/toast";
import { RomanizationEditPopover } from "@/views/edit/romanization-edit-popover";

// -- Types --------------------------------------------------------------------

interface RomanizationSubrowProps {
  line: LyricLine;
}

// -- Helpers ------------------------------------------------------------------

function resolveSchemeForLine(line: LyricLine): string {
  const stored = useProjectStore.getState().metadata.romanizationScheme;
  if (stored) return stored;
  const detected = detectNonLatinLanguage(line.text);
  return detected ? defaultSchemeForLang(detected) : "und-Latn";
}

function wordTextsForDisplay(line: LyricLine): string[] | null {
  const wordTexts = line.romanization?.wordTexts;
  if (!wordTexts) return null;
  if (wordTexts.length !== line.words?.length) return null;
  return wordTexts;
}

// -- Component ----------------------------------------------------------------

const RomanizationSubrow: React.FC<RomanizationSubrowProps> = ({ line }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const textRegionRef = useRef<HTMLButtonElement>(null);

  const romanizationText = line.romanization?.text;
  if (!romanizationText) return null;

  const displayWords = wordTextsForDisplay(line);

  const handleRefresh = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsRefreshing(true);
    try {
      const summary = await generateForLine(resolveSchemeForLine(line), line);
      toastBulkResult(summary);
    } catch (err) {
      toastError(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenPopover = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsPopoverOpen(true);
  };

  return (
    <div
      data-testid="romanization-subrow"
      className="flex items-center gap-1.5 pl-13 pr-3 py-0.5 text-xs text-composer-text-muted select-none"
    >
      <button
        ref={textRegionRef}
        type="button"
        data-testid="romanization-text-region"
        onClick={handleOpenPopover}
        className="flex items-center gap-1 text-left cursor-pointer hover:text-composer-text"
      >
        {displayWords ? (
          <span className="flex items-center gap-1">
            {displayWords.map((wordText, index) => (
              <span key={`${line.id}-${index}-${wordText}`} data-testid="romanization-word">
                {wordText}
              </span>
            ))}
          </span>
        ) : (
          <span data-testid="romanization-line-text">{romanizationText}</span>
        )}
      </button>
      <button
        type="button"
        aria-label="Refresh romanization"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center justify-center size-5 rounded cursor-pointer text-composer-text-muted hover:text-composer-text hover:bg-composer-button-hover disabled:opacity-50 disabled:cursor-default"
      >
        <IconRefresh className="size-3.5" />
      </button>
      {isPopoverOpen && (
        <RomanizationEditPopover
          line={line}
          isOpen
          onClose={() => setIsPopoverOpen(false)}
          anchor={textRegionRef.current}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationSubrow };
export type { RomanizationSubrowProps };
