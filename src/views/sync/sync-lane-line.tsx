import type { SyncGranularity } from "@/domain/line/sync-progress";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { stripSplitCharacter } from "@/utils/split-character";
import type { LaneRow } from "@/views/sync/lane-rows";
import { laneSlotState } from "@/views/sync/lane-slot-state";
import { LaneWord, TapRing } from "@/views/sync/sync-lane-word";
import { memo } from "react";

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
  ring: LaneRing | null;
  onRingDone: () => void;
  aboveCurrent?: React.ReactNode;
  className?: string;
}

type LaneWordsProps = Omit<SyncLaneLineProps, "granularity" | "aboveCurrent" | "className">;

// -- Components ---------------------------------------------------------------

interface WordModeSlotProps extends LaneWordsProps {
  widx: number;
  hasDot: boolean;
}

const WordModeSlot: React.FC<WordModeSlotProps> = ({
  row,
  isCurrent,
  isLastLine,
  wordIndex,
  isHolding,
  isPlacing,
  ring,
  onRingDone,
  widx,
  hasDot,
}) => {
  const state = laneSlotState({
    slot: widx,
    slotCount: row.wordTexts.length,
    isCurrent,
    isLastLine,
    wordIndex,
    isHolding,
  });
  const isNext = state === "next";
  return (
    <LaneWord
      state={state}
      onCurrentLine={isCurrent}
      isHeld={isHolding && isNext}
      dimmed={isPlacing && widx > 0}
      hasDot={hasDot}
    >
      <span className="relative">{row.wordTexts[widx]}</span>
      {ring?.wordIndex === widx && <TapRing key={ring.nonce} onComplete={onRingDone} />}
    </LaneWord>
  );
};

const WordModeWords: React.FC<LaneWordsProps> = (props) => {
  const { row, isCurrent } = props;
  return row.wordRuns.map((run) => {
    const hasDot = isCurrent && run.end > run.start;
    return (
      <span key={`${row.line.id}-${run.start}`} className="relative inline-flex">
        {Array.from({ length: run.end - run.start + 1 }, (_, offset) => (
          <WordModeSlot key={run.start + offset} {...props} widx={run.start + offset} hasDot={hasDot} />
        ))}
      </span>
    );
  });
};

const LineModeWord: React.FC<LaneWordsProps> = ({ row, isCurrent, isLastLine, isHolding }) => (
  <LaneWord
    state={isCurrent ? "next" : isLastLine ? "lastTapped" : "plain"}
    onCurrentLine={isCurrent}
    isHeld={isHolding && isCurrent}
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
      aria-current={isCurrent || undefined}
      className={cn(
        "flex flex-col gap-1.5 w-fit max-w-full self-center items-center text-center origin-center",
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
          <span className="absolute inset-x-0 bottom-full flex justify-center pb-2">{aboveCurrent}</span>
        )}
        <div
          className={cn(
            "relative flex flex-wrap justify-center gap-x-4 text-4xl font-semibold tracking-[-0.012em] leading-[1.1]",
            showsDots ? "gap-y-5 pb-4" : "gap-y-1.5",
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
