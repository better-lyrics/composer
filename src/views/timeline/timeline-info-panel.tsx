import { useAudioStore } from "@/stores/audio";
import { useProjectStore, getAgentColor } from "@/stores/project";
import { Button } from "@/ui/button";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { formatTime } from "@/views/timeline/utils";
import { IconBracketsContainEnd, IconBracketsContainStart } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";

// -- Component -----------------------------------------------------------------

const TimelineInfoPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);
  const selectedWord = useTimelineStore((s) => s.selectedWord);

  const selectedItem = useMemo(() => {
    if (!selectedWord) return null;
    const line = lines[selectedWord.lineIndex];
    if (!line) return null;

    const wordsArray = selectedWord.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return null;

    const word = wordsArray[selectedWord.wordIndex];
    if (!word) return null;

    return { text: word.text, begin: word.begin, end: word.end };
  }, [selectedWord, lines]);

  const handleSetBeginToCursor = useCallback(() => {
    if (!selectedWord) return;
    const line = lines[selectedWord.lineIndex];
    if (!line) return;

    const wordsArray = selectedWord.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const audioEl = useAudioStore.getState().audioElement;
    const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;

    const wordIndex = selectedWord.wordIndex;
    const word = wordsArray[wordIndex];
    if (!word) return;

    const prevEnd = wordIndex > 0 ? wordsArray[wordIndex - 1].end : 0;
    const maxBegin = word.end - 0.05;
    const clampedBegin = Math.max(prevEnd, Math.min(maxBegin, Math.max(0, currentTime)));

    const updatedWords = [...wordsArray];
    updatedWords[wordIndex] = { ...word, begin: clampedBegin };

    if (selectedWord.type === "word") {
      updateLineWithHistory(line.id, { words: updatedWords });
    } else {
      updateLineWithHistory(line.id, { backgroundWords: updatedWords });
    }
  }, [selectedWord, lines, updateLineWithHistory]);

  const handleSetEndToCursor = useCallback(() => {
    if (!selectedWord) return;
    const line = lines[selectedWord.lineIndex];
    if (!line) return;

    const wordsArray = selectedWord.type === "word" ? line.words : line.backgroundWords;
    if (!wordsArray) return;

    const audioEl = useAudioStore.getState().audioElement;
    const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;

    const wordIndex = selectedWord.wordIndex;
    const word = wordsArray[wordIndex];
    if (!word) return;

    const minEnd = word.begin + 0.05;
    const nextBegin = wordIndex < wordsArray.length - 1 ? wordsArray[wordIndex + 1].begin : duration;
    const clampedEnd = Math.min(nextBegin, Math.max(minEnd, Math.min(duration, currentTime)));

    const updatedWords = [...wordsArray];
    updatedWords[wordIndex] = { ...word, end: clampedEnd };

    if (selectedWord.type === "word") {
      updateLineWithHistory(line.id, { words: updatedWords });
    } else {
      updateLineWithHistory(line.id, { backgroundWords: updatedWords });
    }
  }, [selectedWord, lines, duration, updateLineWithHistory]);

  if (!selectedWord || !selectedItem) return null;

  const line = lines[selectedWord.lineIndex];
  if (!line) return null;

  const color = getAgentColor(line.agentId);
  const itemDuration = selectedItem.end - selectedItem.begin;

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-t border-composer-border bg-composer-bg-elevated">
      {/* Agent indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-composer-text-muted">Line {selectedWord.lineIndex + 1}</span>
      </div>

      {/* Text */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-composer-text">
          {selectedWord.type === "bg" ? `(${selectedItem.text})` : selectedItem.text}
        </span>
      </div>

      {/* Timing */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">Begin:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(selectedItem.begin)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">End:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(selectedItem.end)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">Duration:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(itemDuration)}</span>
        </div>
      </div>

      {/* Timing adjustment buttons */}
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="secondary" size="sm" hasIcon onClick={handleSetBeginToCursor} title="Set begin to cursor ([)">
          <IconBracketsContainStart className="w-3.5 h-3.5" />
          <span>Set Begin</span>
        </Button>
        <Button variant="secondary" size="sm" hasIcon onClick={handleSetEndToCursor} title="Set end to cursor (])">
          <IconBracketsContainEnd className="w-3.5 h-3.5" />
          <span>Set End</span>
        </Button>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineInfoPanel };
