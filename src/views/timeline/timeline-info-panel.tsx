import { getAgentColor, type WordTiming } from "@/stores/project";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";

// -- Interfaces ----------------------------------------------------------------

interface TimelineInfoPanelProps {
  lineNumber: number;
  agentId: string;
  word: WordTiming;
  wordType: "word" | "bg";
  currentTime: number;
  onUpdateBegin: (newBegin: number) => void;
  onUpdateEnd: (newEnd: number) => void;
}

// -- Component -----------------------------------------------------------------

const TimelineInfoPanel: React.FC<TimelineInfoPanelProps> = ({
  lineNumber,
  agentId,
  word,
  wordType,
  currentTime,
  onUpdateBegin,
  onUpdateEnd,
}) => {
  const agentColor = getAgentColor(agentId);
  const duration = word.end - word.begin;

  return (
    <div className="flex items-center gap-6 px-6 py-3 border-t border-composer-border bg-composer-bg-dark">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: agentColor }} />
        <span className="text-sm text-composer-text-muted">
          Line {lineNumber}
          {wordType === "bg" && " (bg)"}
        </span>
      </div>
      <span className="text-lg font-medium select-text">{word.text}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-composer-text-muted">Begin</span>
        <TimeNudgeInput
          value={word.begin}
          currentTime={currentTime}
          canDecrease
          canIncrease
          onNudge={(delta) => onUpdateBegin(word.begin + delta)}
          onSetTime={onUpdateBegin}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-composer-text-muted">End</span>
        <TimeNudgeInput
          value={word.end}
          currentTime={currentTime}
          canDecrease
          canIncrease
          onNudge={(delta) => onUpdateEnd(word.end + delta)}
          onSetTime={onUpdateEnd}
        />
      </div>
      <span className="text-sm text-composer-text-muted select-text">Duration: {(duration * 1000).toFixed(0)}ms</span>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineInfoPanel };
export type { TimelineInfoPanelProps };
