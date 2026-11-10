import type { LinkGroup } from "@/domain/group/template";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";
import type { LanguageDisplayLine } from "@/domain/language/display";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { SkippedInstance } from "@/domain/sync/skipped-instances";
import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { ScrollableLine, type ScrollableLineLinkInfo } from "@/views/sync/scrollable-line";
import { SkippedInstanceBand } from "@/views/sync/skipped-instance-band";
import { type SyncLineListHandlers, useRowCallbacks } from "@/views/sync/use-row-callbacks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ListItem, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

// -- Interfaces ---------------------------------------------------------------

interface SyncLineListProps {
  lines: readonly LyricLine[];
  displayLines: readonly LanguageDisplayLine[];
  groups: readonly LinkGroup[];
  granularity: "line" | "word";
  currentTime: number;
  playingLineIndex: number;
  cursorLineIndex: number;
  editMode: boolean;
  isComplete: boolean;
  skippedLineIds: ReadonlySet<string>;
  skippedByLastLineId: ReadonlyMap<string, SkippedInstance>;
  handlers: SyncLineListHandlers;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Constants ----------------------------------------------------------------

// Rows this far past the viewport stay mounted, so a nearby current line scrolls into place as one smooth move.
const MOUNTED_BEYOND_VIEWPORT_PX = 600;

// -- Functions ----------------------------------------------------------------

function lineKey(_index: number, line: LyricLine): string {
  return line.id;
}

// A mounted row scrolls itself to the centre; an unmounted one goes through Virtuoso, which corrects as rows measure.
function revealLine(scrollParent: HTMLElement, virtuoso: VirtuosoHandle | null, index: number) {
  const row = scrollParent.querySelector(`[data-sync-line="${index + 1}"]`);
  if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  else virtuoso?.scrollToIndex({ index, align: "center", behavior: "smooth" });
}

// -- Components ---------------------------------------------------------------

const SyncLineList: React.FC<SyncLineListProps> = ({
  lines,
  displayLines,
  groups,
  granularity,
  currentTime,
  playingLineIndex,
  cursorLineIndex,
  editMode,
  isComplete,
  skippedLineIds,
  skippedByLastLineId,
  handlers,
  scrollContainerRef,
}) => {
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const linkInfoByLineId = useMemo(() => {
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
  }, [lines, groupsById, skippedLineIds]);

  const rowCallbacks = useRowCallbacks(handlers);
  const { handleJumpToLine } = handlers;
  const currentLineIndex = editMode ? playingLineIndex : cursorLineIndex;

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const [rowsRendered, setRowsRendered] = useState(false);
  const attachScrollParent = useCallback(
    (element: HTMLDivElement | null) => {
      scrollContainerRef.current = element;
      setScrollParent(element);
    },
    [scrollContainerRef],
  );
  const noteRowsRendered = useCallback((items: ListItem<LyricLine>[]) => {
    if (items.length > 0) setRowsRendered(true);
  }, []);

  useEffect(() => {
    if (!rowsRendered || !scrollParent || currentLineIndex < 0) return;
    const frame = nextFrame(() => revealLine(scrollParent, virtuosoRef.current, currentLineIndex));
    return () => cancelNextFrame(frame);
  }, [rowsRendered, scrollParent, currentLineIndex]);

  const renderLine = (index: number, line: LyricLine) => {
    const displayLine = displayLines[index];
    const timing = effectiveBounds(line);
    const skipped = skippedByLastLineId.get(line.id);
    const skippedGroup = skipped && groupsById.get(skipped.groupId);
    return (
      <>
        <ScrollableLine
          {...rowCallbacks(index)}
          lineId={line.id}
          lineNumber={index + 1}
          text={line.text}
          displayText={displayLine.text}
          displayWordTexts={displayLine.wordTexts}
          isCurrent={index === currentLineIndex}
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
          editMode={editMode}
          linkInfo={linkInfoByLineId.get(line.id)}
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
      </>
    );
  };

  return (
    <div ref={attachScrollParent} className="flex-1 overflow-y-auto overscroll-none">
      {scrollParent && (
        <Virtuoso
          ref={virtuosoRef}
          data={lines}
          computeItemKey={lineKey}
          itemContent={renderLine}
          itemsRendered={noteRowsRendered}
          customScrollParent={scrollParent}
          increaseViewportBy={MOUNTED_BEYOND_VIEWPORT_PX}
        />
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncLineList };
