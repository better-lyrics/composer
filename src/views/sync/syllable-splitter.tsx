import type { WordTiming } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Popover } from "@/ui/popover";
import { distributeTiming } from "@/utils/syllable-utils";
import { splitSourceWord } from "@/utils/word-timing";
import { IconScissors } from "@tabler/icons-react";
import { nanoid } from "nanoid";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableSplitterProps {
  word: WordTiming;
  wordIndex: number;
  onSplit: (wordIndex: number, newWords: WordTiming[]) => void;
}

// -- Components ---------------------------------------------------------------

const getHyphenationSplitPoints = (hyphenated: string): number[] => {
  const points: number[] = [];
  let originalIndex = 0;

  for (const char of hyphenated) {
    if (char === "\u00AD") {
      points.push(originalIndex);
    } else {
      originalIndex += 1;
    }
  }

  return points;
};

const SplitModeContent: React.FC<{
  text: string;
  splitPoints: number[];
  onToggleSplit: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ text, splitPoints, onToggleSplit, onConfirm, onCancel }) => {
  const chars = text.split("");
  const autoAppliedRef = useRef(false);

  useEffect(() => {
    if (autoAppliedRef.current || splitPoints.length > 0) return;

    let cancelled = false;

    const applyAutoSplitPoints = async () => {
      try {
        const { hyphenateSync } = await import(`hyphen/${useSettingsStore.getState().languageAutoSplit}`);
        
        const hyphenated = hyphenateSync(text);
        const autoSplitPoints = getHyphenationSplitPoints(hyphenated);

        if (!cancelled && autoSplitPoints.length > 0) {
          autoSplitPoints.forEach((point) => onToggleSplit(point));
          autoAppliedRef.current = true;
        }
      } catch (_) {
        // ignore hyphenation failures
      }
    };

    applyAutoSplitPoints();

    return () => {
      cancelled = true;
    };
  }, [text, splitPoints.length, onToggleSplit]);

  const previewParts = useMemo(() => {
    if (splitPoints.length === 0) return [text];
    const sorted = splitPoints.toSorted((a, b) => a - b);
    const result: string[] = [];
    let lastIdx = 0;
    for (const point of sorted) {
      if (point > lastIdx && point < text.length) {
        result.push(text.slice(lastIdx, point));
        lastIdx = point;
      }
    }
    result.push(text.slice(lastIdx));
    return result;
  }, [text, splitPoints]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-composer-text-secondary">Click between letters to mark split points</p>

      <div className="flex flex-wrap items-center justify-center gap-0.5 py-4 text-2xl tracking-wide">
        {chars.map((char, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: character order is fixed in word
          <span key={idx} className="flex items-center">
            <span className="text-composer-text">{char}</span>
            {idx < chars.length - 1 && (
              <button
                type="button"
                onClick={() => onToggleSplit(idx + 1)}
                className={`w-4 h-8 flex items-center group justify-center mx-0.5 rounded transition-colors cursor-pointer ${
                  splitPoints.includes(idx + 1)
                    ? "bg-composer-accent"
                    : "bg-composer-button hover:bg-composer-button-hover"
                }`}
              >
                <span
                  className={`text-sm font-bold ${
                    splitPoints.includes(idx + 1)
                      ? "text-white"
                      : "text-composer-text-tertiary group-hover:text-composer-text"
                  }`}
                >
                  ⋮
                </span>
              </button>
            )}
          </span>
        ))}
      </div>

      {splitPoints.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-composer-text-muted">
          <span>Preview:</span>
          <span className="font-medium text-composer-text">{previewParts.join(" · ")}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm} disabled={splitPoints.length === 0}>
          Split Word
        </Button>
      </div>
    </div>
  );
};

const SyllableSplitter: React.FC<SyllableSplitterProps> = ({ word, wordIndex, onSplit }) => {
  const [splitPoints, setSplitPoints] = useState<number[]>([]);

  const handleToggleSplit = useCallback((index: number) => {
    setSplitPoints((prev) => (prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index]));
  }, []);

  const handleConfirmSplit = useCallback(
    (close: () => void) => {
      const groupId = word.syllableGroupId ?? nanoid(8);
      const sourceForSplit: WordTiming = { ...word, syllableGroupId: groupId };
      const partitions = distributeTiming(word.text, splitPoints, word.begin, word.end);
      const newWords = splitSourceWord(sourceForSplit, partitions);
      onSplit(wordIndex, newWords);
      setSplitPoints([]);
      close();
    },
    [word, splitPoints, wordIndex, onSplit],
  );

  const handleCancelSplit = useCallback((close: () => void) => {
    setSplitPoints([]);
    close();
  }, []);

  // Can't split single-character words (after trimming trailing space)
  const trimmedLength = word.text.trimEnd().length;
  if (trimmedLength < 2) {
    return null;
  }

  return (
    <Popover
      trigger={
        <Button
          size="sm"
          variant="ghost"
          title="Split into syllables"
          className="px-1.5 py-0.5 h-auto align-middle rounded-sm"
        >
          <IconScissors className="size-3" />
        </Button>
      }
    >
      {(close) => (
        <div className="p-5">
          <h3 className="mb-4 text-lg font-medium">Split "{word.text.trimEnd()}"</h3>
          <SplitModeContent
            text={word.text.trimEnd()}
            splitPoints={splitPoints}
            onToggleSplit={handleToggleSplit}
            onConfirm={() => handleConfirmSplit(close)}
            onCancel={() => handleCancelSplit(close)}
          />
        </div>
      )}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyllableSplitter, SplitModeContent };
