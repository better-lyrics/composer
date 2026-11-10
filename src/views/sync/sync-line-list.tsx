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
  splitCharacter: string;
}

// -- Constants ----------------------------------------------------------------

// Rows this far past the viewport stay mounted, so a nearby current line scrolls into place as one smooth move.
const MOUNTED_BEYOND_VIEWPORT_PX = 600;

// -- Functions ----------------------------------------------------------------

function lineKey(_index: number, line: LyricLine): string {
  return line.id;
}

function mountedRow(scrollParent: HTMLElement, index: number): Element | null {
  return scrollParent.querySelector(`[data-sync-line="${index + 1}"]`);
}

function centreRow(row: Element) {
  row.scrollIntoView({ behavior: "smooth", block: "center" });
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
  splitCharacter,
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
      // A hidden Activity detaches refs; dropping the parent then would remount Virtuoso empty on every reveal.
      if (element) setScrollParent(element);
    },
    [scrollContainerRef],
  );
  const farRevealIndex = useRef<number | null>(null);
  const noteRowsRendered = useCallback(
    (items: ListItem<LyricLine>[]) => {
      if (items.length > 0) setRowsRendered(true);
      const index = farRevealIndex.current;
      if (index === null || !items.some((item) => item.index === index)) return;
      farRevealIndex.current = null;
      nextFrame(() => {
        const row = scrollContainerRef.current && mountedRow(scrollContainerRef.current, index);
        if (row) centreRow(row);
      });
    },
    [scrollContainerRef],
  );

  const centredLineIndex = useRef<number | null>(null);
  // Smooth scrollToIndex over unmeasured rows aims at an estimate and gives up after a second, short of the line.
  // Activity re-runs this on every reveal; the list then stays where it was left unless the current line moved.
  useEffect(() => {
    if (!rowsRendered || !scrollParent || currentLineIndex < 0 || currentLineIndex === centredLineIndex.current) return;
    const frame = nextFrame(() => {
      centredLineIndex.current = currentLineIndex;
      const row = mountedRow(scrollParent, currentLineIndex);
      if (row) return centreRow(row);
      farRevealIndex.current = currentLineIndex;
      virtuosoRef.current?.scrollToIndex({ index: currentLineIndex, align: "center" });
    });
    return () => {
      cancelNextFrame(frame);
      farRevealIndex.current = null;
    };
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
          splitCharacter={splitCharacter}
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
