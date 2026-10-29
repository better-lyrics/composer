import { instanceCount, instanceOrdinal } from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { applyWordPatch } from "@/utils/word-patch";
import { GROUP_HEADER_HEIGHT, GroupHeaderRow } from "@/views/timeline/group-header-row";
import { LineRow } from "@/views/timeline/line-row";
import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { PitchRowsScope } from "@/views/timeline/pitch/pitch-rows";
import { emptyBgRowHeight, lineRowHeight } from "@/views/timeline/row-geometry";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type EffectiveRow, getEffectiveRows } from "@/views/timeline/utils";
import { type RefObject, useCallback, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";

// -- Types ---------------------------------------------------------------------

interface TimelineRowsProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

type WordUpdateHandler = (
  wordIndex: number,
  updates: Partial<WordTiming>,
  adjacentIndex?: number,
  adjacentUpdates?: Partial<WordTiming>,
) => void;

interface RowUpdateHandlers {
  word: WordUpdateHandler;
  bg: WordUpdateHandler;
}

// -- Functions -----------------------------------------------------------------

function rowKey(_: number, row: EffectiveRow): string {
  return row.kind === "group-header" ? `header:${row.firstLineId}` : row.line.id;
}

// -- Component -----------------------------------------------------------------

const TimelineRows: React.FC<TimelineRowsProps> = ({ scrollContainerRef }) => {
  const bandHeight = useOverviewBandHeight();
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const duration = useAudioStore((s) => s.duration);
  const zoom = useTimelineStore((s) => s.zoom);
  const rowHeights = useTimelineStore((s) => s.rowHeights);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  const openProjectId = useOpenProjectId();

  const allRows = useMemo(() => getEffectiveRows(lines, focusedGroup), [lines, focusedGroup]);

  const visibleRows = useMemo(() => {
    const out: EffectiveRow[] = [];
    let hideUntilNextNonGroup = false;
    let activeKey: string | null = null;
    for (const row of allRows) {
      if (row.kind === "group-header") {
        const key = `${row.groupId}:${row.instanceIdx}`;
        const hidden = collapsedInstances[key] ?? false;
        out.push(row);
        hideUntilNextNonGroup = hidden;
        activeKey = key;
        continue;
      }
      if (hideUntilNextNonGroup) {
        const lineKey = isLinked(row.line) ? `${row.line.groupId}:${row.line.instanceIdx}` : null;
        if (lineKey === activeKey) continue;
        hideUntilNextNonGroup = false;
        activeKey = null;
      }
      out.push(row);
    }
    return out;
  }, [allRows, collapsedInstances]);

  const groupsById = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g])), [groups]);

  const handleUpdateWord = useCallback(
    (
      lineId: string,
      wordIndex: number,
      updates: Partial<WordTiming>,
      adjacentIndex?: number,
      adjacentUpdates?: Partial<WordTiming>,
    ) => {
      const realLine = useProjectStore.getState().lines.find((l) => l.id === lineId);
      if (!realLine) return;

      if (isLineSynced(realLine)) {
        const lineUpdates: Partial<LyricLine> = {};
        if (updates.begin !== undefined) lineUpdates.begin = updates.begin;
        if (updates.end !== undefined) lineUpdates.end = updates.end;
        useProjectStore.getState().updateLineWithHistory(lineId, lineUpdates, { propagateToSiblings: false });
        return;
      }

      if (!realLine.words) return;
      const updatedWords = applyWordPatch(
        realLine.words,
        wordIndex,
        updates,
        adjacentIndex !== undefined && adjacentUpdates ? { index: adjacentIndex, updates: adjacentUpdates } : undefined,
      );
      if (!updatedWords) return;
      useProjectStore.getState().updateLineWithHistory(lineId, { words: updatedWords }, { propagateToSiblings: false });
    },
    [],
  );

  const handleUpdateBgWord = useCallback(
    (
      lineId: string,
      wordIndex: number,
      updates: Partial<WordTiming>,
      adjacentIndex?: number,
      adjacentUpdates?: Partial<WordTiming>,
    ) => {
      const line = useProjectStore.getState().lines.find((l) => l.id === lineId);
      if (!line?.backgroundWords) return;

      const updatedWords = applyWordPatch(
        line.backgroundWords,
        wordIndex,
        updates,
        adjacentIndex !== undefined && adjacentUpdates ? { index: adjacentIndex, updates: adjacentUpdates } : undefined,
      );
      if (!updatedWords) return;
      useProjectStore
        .getState()
        .updateLineWithHistory(lineId, manualBackgroundWordEdit(updatedWords), { propagateToSiblings: false });
    },
    [],
  );

  const [rowHandlers] = useState(() => new Map<string, RowUpdateHandlers>());
  const handlersFor = useCallback(
    (lineId: string): RowUpdateHandlers => {
      let handlers = rowHandlers.get(lineId);
      if (!handlers) {
        handlers = {
          word: (wordIndex, updates, adjacentIndex, adjacentUpdates) =>
            handleUpdateWord(lineId, wordIndex, updates, adjacentIndex, adjacentUpdates),
          bg: (wordIndex, updates, adjacentIndex, adjacentUpdates) =>
            handleUpdateBgWord(lineId, wordIndex, updates, adjacentIndex, adjacentUpdates),
        };
        rowHandlers.set(lineId, handlers);
      }
      return handlers;
    },
    [rowHandlers, handleUpdateWord, handleUpdateBgWord],
  );

  const renderRow = useCallback(
    (_: number, row: EffectiveRow) => {
      if (row.kind === "group-header") {
        const group = groupsById.get(row.groupId);
        if (!group) return <div style={{ height: GROUP_HEADER_HEIGHT }} />;
        return (
          <GroupHeaderRow
            group={group}
            instanceIdx={row.instanceIdx}
            ordinal={instanceOrdinal(lines, row.groupId, row.instanceIdx)}
            totalInstances={instanceCount(lines, row.groupId)}
            instanceStart={row.instanceStart}
            instanceEnd={row.instanceEnd}
          />
        );
      }
      const handlers = handlersFor(row.line.id);
      return (
        <LineRow
          line={row.line}
          lineIndex={row.lineIndex}
          duration={duration}
          onUpdateWord={handlers.word}
          onUpdateBgWord={handlers.bg}
        />
      );
    },
    [groupsById, lines, duration, handlersFor],
  );

  const totalWidth = duration * zoom;

  const getRowHeight = useCallback(
    (index: number) => {
      const row = visibleRows[index];
      if (!row) return emptyBgRowHeight(defaultRowHeight);
      if (row.kind === "group-header") return GROUP_HEADER_HEIGHT;
      return lineRowHeight(row.line, rowHeights[row.line.id] ?? defaultRowHeight);
    },
    [visibleRows, rowHeights, defaultRowHeight],
  );

  const heightEstimates = useMemo(() => visibleRows.map((_, i) => getRowHeight(i)), [visibleRows, getRowHeight]);
  const totalHeight = useMemo(() => heightEstimates.reduce((sum, height) => sum + height, 0), [heightEstimates]);
  // Virtuoso reads the estimates only when it mounts and treats every row it never rendered as the default height,
  // so it remounts when rows change height off screen. A row resize happens on screen, where Virtuoso measures it.
  const offscreenLayoutKey = useMemo(
    () =>
      visibleRows.map((row) => (row.kind === "group-header" ? "h" : lineRowHeight(row.line, defaultRowHeight))).join(),
    [visibleRows, defaultRowHeight],
  );

  return (
    <PitchRowsScope
      viewportRef={scrollContainerRef}
      style={{ width: totalWidth + GUTTER_WIDTH, minWidth: "100%", height: totalHeight }}
    >
      <Virtuoso
        key={`${openProjectId}:${offscreenLayoutKey}`}
        data={visibleRows}
        computeItemKey={rowKey}
        itemContent={renderRow}
        style={{ height: "100%", width: "100%" }}
        customScrollParent={scrollContainerRef.current ?? undefined}
        overscan={200}
        heightEstimates={heightEstimates}
        increaseViewportBy={{ top: bandHeight, bottom: 0 }}
      />
    </PitchRowsScope>
  );
};

// -- Exports -------------------------------------------------------------------

export { TimelineRows };
