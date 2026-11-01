import type { LinkGroup } from "@/domain/group/template";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";
import type { LanguageDisplayLine } from "@/domain/language/display";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { SkippedInstance } from "@/domain/sync/skipped-instances";
import type { useSyncHandlers } from "@/hooks/useSyncHandlers";
import { ScrollableLine, type ScrollableLineLinkInfo } from "@/views/sync/scrollable-line";
import { SkippedInstanceBand } from "@/views/sync/skipped-instance-band";
import { Fragment, useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

type SyncEditHandlers = Pick<
  ReturnType<typeof useSyncHandlers>,
  | "handleJumpToLine"
  | "handleJumpToWord"
  | "handleJumpToBgWord"
  | "handleNudgeWord"
  | "handleSetWordTime"
  | "handleNudgeWordEnd"
  | "handleSetWordEndTime"
  | "handleNudgeLine"
  | "handleSetLineTime"
  | "handleSplitWord"
  | "handleNudgeBgWord"
  | "handleSetBgWordTime"
  | "handleNudgeBgWordEnd"
  | "handleSetBgWordEndTime"
>;

interface SyncEditListProps {
  lines: readonly LyricLine[];
  displayLines: readonly LanguageDisplayLine[];
  groups: readonly LinkGroup[];
  granularity: "line" | "word";
  currentTime: number;
  playingLineIndex: number;
  isComplete: boolean;
  skippedLineIds: ReadonlySet<string>;
  skippedByLastLineId: ReadonlyMap<string, SkippedInstance>;
  handlers: SyncEditHandlers;
  scrollContainerRef: React.Ref<HTMLDivElement>;
}

// -- Components ---------------------------------------------------------------

const SyncEditList: React.FC<SyncEditListProps> = ({
  lines,
  displayLines,
  groups,
  granularity,
  currentTime,
  playingLineIndex,
  isComplete,
  skippedLineIds,
  skippedByLastLineId,
  handlers,
  scrollContainerRef,
}) => {
  const linkInfoByLineId = useMemo(() => {
    const groupsById = new Map(groups.map((g) => [g.id, g]));
    const positions = instancePositionsByLineId(lines);
    const out = new Map<string, ScrollableLineLinkInfo>();
    for (const line of lines) {
      if (!isLinked(line)) continue;
      const group = groupsById.get(line.groupId);
      const position = positions.get(line.id);
      if (!group || !position) continue;
      out.set(line.id, {
        color: group.color,
        label: group.label,
        ordinal: position.ordinal,
        totalInstances: position.count,
        shared: skippedLineIds.has(line.id),
      });
    }
    return out;
  }, [lines, groups, skippedLineIds]);

  const {
    handleJumpToLine,
    handleJumpToWord,
    handleJumpToBgWord,
    handleNudgeWord,
    handleSetWordTime,
    handleNudgeWordEnd,
    handleSetWordEndTime,
    handleNudgeLine,
    handleSetLineTime,
    handleSplitWord,
    handleNudgeBgWord,
    handleSetBgWordTime,
    handleNudgeBgWordEnd,
    handleSetBgWordEndTime,
  } = handlers;

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-none">
      <div>
        {lines.map((line, index) => {
          const displayLine = displayLines[index];
          const timing = effectiveBounds(line);
          const skipped = skippedByLastLineId.get(line.id);
          const skippedGroup = skipped && groups.find((group) => group.id === skipped.groupId);
          return (
            <Fragment key={line.id}>
              <ScrollableLine
                lineId={line.id}
                lineNumber={index + 1}
                text={line.text}
                displayText={displayLine.text}
                displayWordTexts={displayLine.wordTexts}
                isCurrent={index === playingLineIndex}
                agentId={line.agentId}
                backgroundText={line.backgroundText}
                displayBackgroundText={displayLine.backgroundText}
                displayBackgroundWordTexts={displayLine.backgroundWordTexts}
                backgroundWords={displayLine.backgroundWords ?? line.backgroundWords}
                words={displayLine.words ?? line.words}
                lineBegin={timing?.begin}
                lineEnd={timing?.end}
                lineSynced={isLineSynced(line)}
                granularity={granularity}
                currentTime={currentTime}
                editMode
                linkInfo={linkInfoByLineId.get(line.id)}
                onClick={() => handleJumpToLine(index)}
                onClickWord={(wordIdx) => handleJumpToWord(index, wordIdx)}
                onClickBgWord={(wordIdx) => handleJumpToBgWord(index, wordIdx)}
                onNudgeWord={(wordIdx, delta) => handleNudgeWord(index, wordIdx, delta)}
                onSetWordTime={(wordIdx, newBegin) => handleSetWordTime(index, wordIdx, newBegin)}
                onNudgeWordEnd={(wordIdx, delta) => handleNudgeWordEnd(index, wordIdx, delta)}
                onSetWordEndTime={(wordIdx, newEnd) => handleSetWordEndTime(index, wordIdx, newEnd)}
                onNudgeLine={(delta) => handleNudgeLine(index, delta)}
                onSetLineTime={(newBegin) => handleSetLineTime(index, newBegin)}
                onSplitWord={(wordIdx, newWords) => handleSplitWord(index, wordIdx, newWords)}
                onNudgeBgWord={(wordIdx, delta) => handleNudgeBgWord(index, wordIdx, delta)}
                onSetBgWordTime={(wordIdx, newBegin) => handleSetBgWordTime(index, wordIdx, newBegin)}
                onNudgeBgWordEnd={(wordIdx, delta) => handleNudgeBgWordEnd(index, wordIdx, delta)}
                onSetBgWordEndTime={(wordIdx, newEnd) => handleSetBgWordEndTime(index, wordIdx, newEnd)}
              />
              {skipped && skippedGroup && !isComplete && (
                <SkippedInstanceBand
                  groupId={skipped.groupId}
                  instanceIdx={skipped.instanceIdx}
                  firstLineIndex={skipped.firstLineIndex}
                  skippedCount={skipped.syncableLineCount}
                  color={skippedGroup.color}
                  onJumpToLine={handleJumpToLine}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncEditList };
