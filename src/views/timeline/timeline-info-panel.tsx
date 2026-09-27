import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getAgentColor } from "@/domain/agent/colors";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import type { BoundaryEdge } from "@/domain/word/boundary";
import type { WordTiming } from "@/domain/word/timing";
import { BackgroundTextEditor } from "@/views/timeline/background-text-editor";
import { Button } from "@/ui/button";
import { setBgWordBoundary } from "@/utils/timing/bg-word-timing";
import { setWordBoundary } from "@/utils/timing/word-timing";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getEffectiveLines } from "@/domain/line/effective-words";
import {
  type GroupHighlight,
  type MultiSelectionSummary,
  multiSelectionSummary,
  selectedWordTiming,
  selectionCountLabel,
  selectionGroupHighlight,
} from "@/views/timeline/selection-info";
import { formatTime } from "@/views/timeline/utils";
import { IconBracketsContainEnd, IconBracketsContainStart, IconLink } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";

// -- Components ----------------------------------------------------------------

const GroupBadge: React.FC<{ highlight: GroupHighlight; title: string }> = ({ highlight, title }) => (
  <span
    className="flex items-center gap-1 px-2 h-5 rounded-md text-[11px] font-medium select-none"
    style={{
      background: `color-mix(in srgb, ${highlight.accentColor} 22%, transparent)`,
      color: highlight.accentColor,
    }}
    title={title}
  >
    <IconLink className="size-3" />
    <span className="tabular-nums">{highlight.label}</span>
  </span>
);

const TimeField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-1">
    <span className="text-composer-text-muted">{label}</span>
    <span className="font-mono text-composer-text select-text">{value}</span>
  </div>
);

const MultiSelectionInfo: React.FC<{ summary: MultiSelectionSummary; highlight: GroupHighlight | null }> = ({
  summary,
  highlight,
}) => (
  <div className="relative flex items-center gap-6 px-6 h-[54px] border-t border-composer-border bg-composer-bg-elevated">
    {highlight && <GroupBadge highlight={highlight} title="Selected words belong to this linked group" />}
    <span className="text-sm font-medium text-composer-text">
      {selectionCountLabel(summary.wordCount, summary.lineCount)}
    </span>
    <div className="flex items-center gap-4 text-sm">
      <TimeField label="Range:" value={`${formatTime(summary.begin)} - ${formatTime(summary.end)}`} />
      <TimeField label="Span:" value={formatTime(summary.end - summary.begin)} />
    </div>
  </div>
);

interface SingleWordInfoProps {
  selection: WordSelection;
  line: ReadableLine;
  item: Pick<WordTiming, "text" | "begin" | "end">;
  highlight: GroupHighlight | null;
  onSetBegin: () => void;
  onSetEnd: () => void;
}

const SingleWordInfo: React.FC<SingleWordInfoProps> = ({ selection, line, item, highlight, onSetBegin, onSetEnd }) => (
  <div className="relative flex items-center gap-6 px-6 py-3 border-t border-composer-border bg-composer-bg-elevated">
    {highlight && <GroupBadge highlight={highlight} title="This word belongs to a linked group" />}
    <div className="flex items-center gap-2">
      <div className="size-2.5 rounded-full" style={{ backgroundColor: getAgentColor(line.agentId) }} />
      <span className="text-sm text-composer-text-muted">
        {selection.type === "bg" ? `Line ${selection.lineIndex + 1} ・ Background` : `Line ${selection.lineIndex + 1}`}
      </span>
    </div>

    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-composer-text">{item.text}</span>
    </div>

    <div className="flex items-center gap-4 text-sm">
      <TimeField label="Begin:" value={formatTime(item.begin)} />
      <TimeField label="End:" value={formatTime(item.end)} />
      <TimeField label="Duration:" value={formatTime(item.end - item.begin)} />
    </div>

    <BackgroundTextEditor lineId={line.id} backgroundText={line.backgroundText} />

    <div className="flex items-center gap-2 ml-auto">
      <Button variant="secondary" size="sm" hasIcon onClick={onSetBegin} title="Set begin to cursor ([)">
        <IconBracketsContainStart className="size-3.5" />
        <span>Set Begin</span>
      </Button>
      <Button variant="secondary" size="sm" hasIcon onClick={onSetEnd} title="Set end to cursor (])">
        <IconBracketsContainEnd className="size-3.5" />
        <span>Set End</span>
      </Button>
    </div>
  </div>
);

const TimelineInfoPanel: React.FC = () => {
  const rawLines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const duration = useAudioStore((s) => s.duration);
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const selectedWord = selectedWords[0] ?? null;

  const lines = useMemo(() => getEffectiveLines(rawLines), [rawLines]);
  const highlight = useMemo(
    () => selectionGroupHighlight(selectedWords, rawLines, groups),
    [selectedWords, rawLines, groups],
  );
  const summary = useMemo(
    () => multiSelectionSummary(selectedWords, lines, rawLines),
    [selectedWords, lines, rawLines],
  );
  const item = useMemo(() => (selectedWord ? selectedWordTiming(selectedWord, lines) : null), [selectedWord, lines]);

  const setSelectedWordBoundary = useCallback(
    (edge: BoundaryEdge) => {
      if (!selectedWord) return;
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      const setBoundaryOp = selectedWord.type === "word" ? setWordBoundary : setBgWordBoundary;
      setBoundaryOp({
        lines,
        lineIdx: selectedWord.lineIndex,
        wordIdx: selectedWord.wordIndex,
        edge,
        time: currentTime,
        minDuration: useSettingsStore.getState().minWordDuration,
        duration,
        rolling: useTimelineStore.getState().rollingEditMode,
        syllablesFollowRolling: useSettingsStore.getState().syllablesFollowRolling,
        updateLineWithHistory,
      });
    },
    [selectedWord, lines, duration, updateLineWithHistory],
  );

  const handleSetBeginToCursor = useCallback(() => setSelectedWordBoundary("begin"), [setSelectedWordBoundary]);
  const handleSetEndToCursor = useCallback(() => setSelectedWordBoundary("end"), [setSelectedWordBoundary]);

  if (summary) return <MultiSelectionInfo summary={summary} highlight={highlight} />;

  const line = selectedWord ? lines[selectedWord.lineIndex] : undefined;
  if (!selectedWord || !item || !line) return null;

  return (
    <SingleWordInfo
      selection={selectedWord}
      line={line}
      item={item}
      highlight={highlight}
      onSetBegin={handleSetBeginToCursor}
      onSetEnd={handleSetEndToCursor}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineInfoPanel };
