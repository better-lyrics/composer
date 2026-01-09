import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TimelineControls } from "@/views/timeline/timeline-controls";
import { TimelineInfoPanel } from "@/views/timeline/timeline-info-panel";
import { TimelineWaveform, type WordSelection } from "@/views/timeline/timeline-waveform";
import { useCallback, useEffect, useState } from "react";

// -- Components ----------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const TimelinePanel: React.FC = () => {
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const lines = useProjectStore((s) => s.lines);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null);

  // Loop playback logic
  useEffect(() => {
    if (!loopEnabled || !loopRegion) return;

    if (currentTime >= loopRegion.end) {
      setCurrentTime(loopRegion.start);
    }
  }, [currentTime, loopEnabled, loopRegion, setCurrentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "l" || e.key === "L") {
        if (loopRegion) setLoopEnabled((prev) => !prev);
      } else if (e.key === "Escape") {
        setLoopRegion(null);
        setLoopEnabled(false);
        setSelectedWord(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loopRegion]);

  const handleUpdateWordBegin = useCallback(
    (newBegin: number) => {
      if (!selectedWord) return;
      const line = lines[selectedWord.lineIndex];
      if (!line) return;

      if (selectedWord.type === "word" && line.words) {
        const updatedWords = [...line.words];
        updatedWords[selectedWord.wordIndex] = {
          ...updatedWords[selectedWord.wordIndex],
          begin: Math.max(0, newBegin),
        };
        updateLineWithHistory(line.id, { words: updatedWords });
      } else if (selectedWord.type === "bg" && line.backgroundWords) {
        const updatedWords = [...line.backgroundWords];
        updatedWords[selectedWord.wordIndex] = {
          ...updatedWords[selectedWord.wordIndex],
          begin: Math.max(0, newBegin),
        };
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      }
    },
    [selectedWord, lines, updateLineWithHistory],
  );

  const handleUpdateWordEnd = useCallback(
    (newEnd: number) => {
      if (!selectedWord) return;
      const line = lines[selectedWord.lineIndex];
      if (!line) return;

      if (selectedWord.type === "word" && line.words) {
        const updatedWords = [...line.words];
        updatedWords[selectedWord.wordIndex] = {
          ...updatedWords[selectedWord.wordIndex],
          end: Math.max(0, newEnd),
        };
        updateLineWithHistory(line.id, { words: updatedWords });
      } else if (selectedWord.type === "bg" && line.backgroundWords) {
        const updatedWords = [...line.backgroundWords];
        updatedWords[selectedWord.wordIndex] = {
          ...updatedWords[selectedWord.wordIndex],
          end: Math.max(0, newEnd),
        };
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      }
    },
    [selectedWord, lines, updateLineWithHistory],
  );

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to display" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  const selectedWordData =
    selectedWord && lines[selectedWord.lineIndex]
      ? selectedWord.type === "word"
        ? lines[selectedWord.lineIndex].words?.[selectedWord.wordIndex]
        : lines[selectedWord.lineIndex].backgroundWords?.[selectedWord.wordIndex]
      : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Timeline</h2>
        <TimelineControls
          rippleEnabled={rippleEnabled}
          onToggleRipple={() => setRippleEnabled(!rippleEnabled)}
          loopRegion={loopRegion}
          loopEnabled={loopEnabled}
          onToggleLoop={() => setLoopEnabled(!loopEnabled)}
          onClearLoop={() => {
            setLoopRegion(null);
            setLoopEnabled(false);
          }}
        />
      </div>
      <div className="flex-1 p-4">
        <TimelineWaveform
          lines={lines}
          rippleEnabled={rippleEnabled}
          loopRegion={loopRegion}
          onLoopRegionChange={setLoopRegion}
          onSelectWord={setSelectedWord}
        />
      </div>
      {selectedWord && selectedWordData && (
        <TimelineInfoPanel
          lineNumber={selectedWord.lineIndex + 1}
          agentId={lines[selectedWord.lineIndex].agentId}
          word={selectedWordData}
          wordType={selectedWord.type}
          currentTime={currentTime}
          onUpdateBegin={handleUpdateWordBegin}
          onUpdateEnd={handleUpdateWordEnd}
        />
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelinePanel };
