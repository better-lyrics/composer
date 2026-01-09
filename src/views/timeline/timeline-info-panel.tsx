import { useProjectStore, getAgentColor } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { formatTime } from "@/views/timeline/utils";

// -- Component -----------------------------------------------------------------

const TimelineInfoPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const selectedWord = useTimelineStore((s) => s.selectedWord);

  if (!selectedWord) return null;

  const line = lines[selectedWord.lineIndex];
  if (!line) return null;

  const words = selectedWord.type === "word" ? line.words : line.backgroundWords;
  const word = words?.[selectedWord.wordIndex];
  if (!word) return null;

  const color = getAgentColor(line.agentId);
  const duration = word.end - word.begin;

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-t border-composer-border bg-composer-bg-elevated">
      {/* Agent indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-composer-text-muted">Line {selectedWord.lineIndex + 1}</span>
      </div>

      {/* Word text */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-composer-text-muted">Word:</span>
        <span className="text-sm font-medium text-composer-text">
          {selectedWord.type === "bg" ? `(${word.text})` : word.text}
        </span>
      </div>

      {/* Timing */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">Begin:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(word.begin)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">End:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(word.end)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-composer-text-muted">Duration:</span>
          <span className="font-mono text-composer-text select-text">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineInfoPanel };
