import type { AgentSide } from "@/domain/agent/side";
import type { SyncGranularity } from "@/domain/line/sync-progress";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import type { LaneRow, WordRun } from "@/views/sync/lane-rows";
import { type LaneClickTarget, laneClickTarget } from "@/views/sync/lane-click-target";
import { laneSlotState } from "@/views/sync/lane-slot-state";
import { LaneWord, type SyllableDot, TapRing } from "@/views/sync/sync-lane-word";
import { memo } from "react";

// -- Types --------------------------------------------------------------------

type LaneJumpTarget = NonNullable<LaneClickTarget>;

// -- Constants ----------------------------------------------------------------

const ROW_SIDE_CLASS: Record<AgentSide, string> = {
  left: "self-start items-start text-left origin-left",
  right: "self-end items-end text-right origin-right",
  center: "self-center items-center text-center origin-center",
};

const WORDS_SIDE_CLASS: Record<AgentSide, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

const LINE_TARGET: LaneJumpTarget = { kind: "line" };

// -- Interfaces ---------------------------------------------------------------

interface LaneRing {
  wordIndex: number;
  nonce: number;
}

interface SyncLaneLineProps {
  row: LaneRow;
  isCurrent: boolean;
  isLastLine: boolean;
  wordIndex: number;
  granularity: SyncGranularity;
  isHolding: boolean;
  isPlacing: boolean;
  paused: boolean;
  ring: LaneRing | null;
  onRingDone: () => void;
  onJump: (lineIndex: number, target: LaneJumpTarget) => void;
  firstSlotSoon: boolean;
  aboveCurrent?: React.ReactNode;
  className?: string;
}

type LaneWordsProps = Omit<SyncLaneLineProps, "granularity" | "aboveCurrent" | "className">;

// -- Components ---------------------------------------------------------------

interface WordModeSlotProps extends LaneWordsProps {
  widx: number;
  run: WordRun;
  dot: SyllableDot | undefined;
}

const WordModeSlot: React.FC<WordModeSlotProps> = ({
  row,
  isCurrent,
  isLastLine,
  wordIndex,
  isHolding,
  isPlacing,
  paused,
  ring,
  onRingDone,
  onJump,
  widx,
  run,
  dot,
}) => {
  const state = laneSlotState({
    slot: widx,
    slotCount: row.wordTexts.length,
    timedSlots: row.timedWords,
    isCurrent,
    isLastLine,
    wordIndex,
    isHolding,
  });
  const isNext = state === "next";
  const target = paused ? laneClickTarget(row.line, widx, "word") : null;
  return (
    <LaneWord
      state={state}
      onCurrentLine={isCurrent}
      isHeld={isHolding && isNext}
      dimmed={isPlacing && widx > 0}
      joinedStart={widx > run.start}
      joinedEnd={widx < run.end}
      dot={dot}
      onClick={target ? () => onJump(row.lineIndex, target) : undefined}
    >
      <span className="relative">{row.wordTexts[widx]}</span>
      {ring?.wordIndex === widx && <TapRing key={ring.nonce} onComplete={onRingDone} />}
    </LaneWord>
  );
};

// A split word is one tap away when the cursor sits on the slot just before it, so its dots turn accent early.
const WordModeWords: React.FC<LaneWordsProps> = (props) => {
  const { row, isCurrent, wordIndex, firstSlotSoon } = props;
  return row.wordRuns.map((run) => {
    const split = run.end > run.start;
    const holdsNext = isCurrent && wordIndex >= run.start && wordIndex <= run.end;
    const soon =
      split &&
      ((isCurrent && wordIndex >= run.start - 1 && wordIndex <= run.end) || (run.start === 0 && firstSlotSoon));
    const dot: SyllableDot | undefined = split ? (soon ? "soon" : "plain") : undefined;
    return (
      <span key={`${row.line.id}-${run.start}`} className="relative inline-flex">
        {split && (
          <span
            aria-hidden
            className={cn(
              "absolute -inset-x-2 -inset-y-1 rounded-lg bg-composer-accent/7 pointer-events-none transition-opacity duration-150 ease-out motion-reduce:transition-none",
              holdsNext ? "opacity-100" : "opacity-0",
            )}
          />
        )}
        {Array.from({ length: run.end - run.start + 1 }, (_, offset) => (
          <WordModeSlot key={run.start + offset} {...props} widx={run.start + offset} run={run} dot={dot} />
        ))}
      </span>
    );
  });
};

const LineModeWord: React.FC<LaneWordsProps> = ({ row, isCurrent, isLastLine, isHolding, paused, onJump }) => (
  <LaneWord
    state={isCurrent ? "next" : isLastLine ? "lastTapped" : row.isTimed ? "timed" : "untimed"}
    onCurrentLine={isCurrent}
    isHeld={isHolding && isCurrent}
    onClick={paused ? () => onJump(row.lineIndex, LINE_TARGET) : undefined}
  >
    <span className="relative">{stripSplitCharacter(row.text)}</span>
  </LaneWord>
);

const SyncLaneLine: React.FC<SyncLaneLineProps> = memo(({ granularity, aboveCurrent, className, ...wordsProps }) => {
  const { row, isCurrent, isPlacing } = wordsProps;
  const hasMeta = row.singer !== undefined || row.groupTag !== undefined;
  const showsDots = granularity === "word" && row.wordRuns.some((run) => run.end > run.start);

  return (
    <div
      dir="auto"
      data-lane-line
      aria-current={isCurrent || undefined}
      className={cn(
        "flex flex-col gap-1.5 w-fit max-w-full",
        ROW_SIDE_CLASS[row.side],
        "rtl:self-end rtl:items-start rtl:text-right rtl:origin-right",
        className,
      )}
    >
      {hasMeta && (
        <div className="flex items-center gap-2 mb-2.5">
          {row.singer && <SingerTag color={row.singer.color}>{row.singer.name}</SingerTag>}
          {row.groupTag && <SingerTag color={row.groupTag.color}>{row.groupTag.label}</SingerTag>}
        </div>
      )}
      <div className="relative flex flex-col gap-1.5 items-[inherit]">
        <span
          aria-hidden
          className={cn(
            "absolute -inset-x-3.5 -inset-y-2.5 rounded-[14px] bg-composer-accent/10 pointer-events-none transition-opacity duration-150 ease-out motion-reduce:transition-none",
            isPlacing ? "opacity-100" : "opacity-0",
          )}
        />
        {isCurrent && aboveCurrent && (
          <span
            className={cn("absolute inset-x-0 bottom-full flex pb-2", WORDS_SIDE_CLASS[row.side], "rtl:justify-start")}
          >
            {aboveCurrent}
          </span>
        )}
        <div
          className={cn(
            "relative flex flex-wrap gap-x-4 text-4xl font-semibold tracking-[-0.012em] leading-[1.1]",
            showsDots ? "gap-y-5 pb-4" : "gap-y-1.5",
            WORDS_SIDE_CLASS[row.side],
            "rtl:justify-start",
          )}
        >
          {granularity === "line" ? <LineModeWord {...wordsProps} /> : <WordModeWords {...wordsProps} />}
        </div>
        {row.backgroundText && (
          <span className="relative text-xl font-medium text-composer-text-faint">
            {stripSplitCharacter(row.backgroundText)}
          </span>
        )}
      </div>
    </div>
  );
});

// -- Exports ------------------------------------------------------------------

export { SyncLaneLine };
export type { LaneRing };
