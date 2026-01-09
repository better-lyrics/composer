import { getAgentColor, type LyricLine, type WordTiming } from "@/stores/project";
import { WordTrack, TRACK_HEIGHT } from "@/views/timeline/word-track";

// -- Types ---------------------------------------------------------------------

interface LineRowProps {
  line: LyricLine;
  lineIndex: number;
  duration: number;
  onUpdateWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
  onUpdateBgWord: (wordIndex: number, updates: Partial<WordTiming>) => void;
}

// -- Constants -----------------------------------------------------------------

const GUTTER_WIDTH = 48;
const COLLAPSED_BG_HEIGHT = 12;

// -- Component -----------------------------------------------------------------

const LineRow: React.FC<LineRowProps> = ({ line, lineIndex, duration, onUpdateWord, onUpdateBgWord }) => {
  const color = getAgentColor(line.agentId);
  const hasBgWords = line.backgroundWords && line.backgroundWords.length > 0;
  const hasMainWords = line.words && line.words.length > 0;

  return (
    <div className="flex border-b border-composer-border/50">
      {/* Gutter */}
      <div
        className="shrink-0 flex items-center justify-center text-xs text-composer-text-muted border-r border-composer-border/50 bg-composer-bg"
        style={{ width: GUTTER_WIDTH }}
      >
        {lineIndex + 1}
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-hidden">
        {/* Main word track */}
        <div
          className="border-l-2"
          style={{
            borderColor: color,
            opacity: hasMainWords ? 1 : 0.5,
          }}
        >
          {hasMainWords ? (
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={line.words!}
              color={color}
              trackType="word"
              duration={duration}
              onUpdateWord={onUpdateWord}
            />
          ) : (
            <div
              style={{ height: TRACK_HEIGHT }}
              className="flex items-center px-3 text-xs text-composer-text-muted italic truncate"
            >
              {line.text.slice(0, 60)}
              {line.text.length > 60 ? "..." : ""}
            </div>
          )}
        </div>

        {/* BG word track (always shown, collapsed when empty) */}
        <div
          className="relative"
          style={{
            borderLeft: `2px dashed ${color}`,
            opacity: hasBgWords ? 0.7 : 0.3,
          }}
        >
          {hasBgWords ? (
            <WordTrack
              lineId={line.id}
              lineIndex={lineIndex}
              words={line.backgroundWords!}
              color={color}
              trackType="bg"
              duration={duration}
              onUpdateWord={onUpdateBgWord}
            />
          ) : (
            <div style={{ height: COLLAPSED_BG_HEIGHT }} />
          )}
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { LineRow, GUTTER_WIDTH };
