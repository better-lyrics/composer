import { IconRefresh } from "@tabler/icons-react";
import { useRef, useState } from "react";
import type { LyricLine } from "@/domain/line/model";
import { generateForLine } from "@/lib/romanization/generate";
import { defaultSchemeForLang } from "@/domain/romanization/schemes";
import { detectNonLatinLanguage } from "@/domain/romanization/detect";
import { useProjectStore } from "@/stores/project";
import { ALT_KEY } from "@/utils/platform";
import { toastBulkResult, toastError } from "@/utils/romanization/toast";
import { RomanizationEditPopover } from "@/views/edit/romanization-edit-popover";
import { RomanizationWordEditPopover } from "@/views/edit/romanization-word-edit-popover";

// -- Constants ----------------------------------------------------------------

const WORD_TOOLTIP = `${ALT_KEY}+click to edit syllable`;

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
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const textRegionRef = useRef<HTMLButtonElement>(null);
  const wordRefs = useRef<Map<number, HTMLElement>>(new Map());

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

  const handleWordClick = (event: React.MouseEvent, wordIndex: number) => {
    if (!event.altKey) return;
    event.stopPropagation();
    event.preventDefault();
    setActiveWordIndex(wordIndex);
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
              <span
                key={`${line.id}-${index}-${wordText}`}
                ref={(el) => {
                  if (el) wordRefs.current.set(index, el);
                  else wordRefs.current.delete(index);
                }}
                data-testid="romanization-word"
                data-clickable-word="true"
                title={WORD_TOOLTIP}
                onClick={(event) => handleWordClick(event, index)}
                className="cursor-pointer"
              >
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
      {activeWordIndex !== null && (
        <RomanizationWordEditPopover
          line={line}
          wordIndex={activeWordIndex}
          isOpen
          onClose={() => setActiveWordIndex(null)}
          anchor={wordRefs.current.get(activeWordIndex) ?? null}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationSubrow };
export type { RomanizationSubrowProps };
