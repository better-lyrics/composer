import { instanceKey, lineInstanceKey } from "@/domain/instance/key";
import { retimeWord } from "@/domain/commands/word-timing";
import type { WordTrack } from "@/domain/line/tracks";
import { addressAt } from "@/domain/selection/resolve";
import type { WordTiming } from "@/domain/word/timing";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { GROUP_HEADER_HEIGHT, GroupHeaderRow } from "@/views/timeline/group-header-row";
import { LineRow, type LineWordUpdate } from "@/views/timeline/line-row";
import { useOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { PitchRowsScope } from "@/views/timeline/pitch/pitch-rows";
import { emptyBgRowHeight, lineRowHeight } from "@/views/timeline/row-geometry";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type EffectiveRow, getEffectiveRows } from "@/views/timeline/effective-rows";
import { type RefObject, useCallback, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";

// -- Types ---------------------------------------------------------------------

interface TimelineRowsProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

// -- Functions -----------------------------------------------------------------

function rowKey(_: number, row: EffectiveRow): string {
  return row.kind === "group-header" ? `header:${row.firstLineId}` : row.line.id;
}

// Rows report words by index; the store's own lines name them, so the command acts on the word that was drawn.
function retimeWordAt(
  lineId: string,
  type: WordTrack,
  wordIndex: number,
  updates: Partial<WordTiming>,
  adjacentIndex?: number,
  adjacentUpdates?: Partial<WordTiming>,
): void {
  const project = useProjectStore.getState();
  const address = addressAt(project.lines, lineId, type, wordIndex);
  if (!address) return;
  const neighbour =
    adjacentIndex !== undefined && adjacentUpdates ? addressAt(project.lines, lineId, type, adjacentIndex) : null;
  if (adjacentIndex !== undefined && adjacentUpdates && !neighbour) return;
  project.commit(
    retimeWord({ address, updates }, neighbour ? { address: neighbour, updates: adjacentUpdates ?? {} } : undefined),
  );
}

const handleUpdateWord: LineWordUpdate = (lineId, wordIndex, updates, adjacentIndex, adjacentUpdates) =>
  retimeWordAt(lineId, "word", wordIndex, updates, adjacentIndex, adjacentUpdates);

const handleUpdateBgWord: LineWordUpdate = (lineId, wordIndex, updates, adjacentIndex, adjacentUpdates) =>
  retimeWordAt(lineId, "bg", wordIndex, updates, adjacentIndex, adjacentUpdates);

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
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getEffectiveRows splits words by the split character
  const allRows = useMemo(() => getEffectiveRows(lines, focusedGroup), [lines, focusedGroup, splitCharacter]);

  const visibleRows = useMemo(() => {
    const out: EffectiveRow[] = [];
    let hideUntilNextNonGroup = false;
    let activeKey: string | null = null;
    for (const row of allRows) {
      if (row.kind === "group-header") {
        const key = instanceKey(row.groupId, row.instanceIdx);
        const hidden = collapsedInstances[key] ?? false;
        out.push(row);
        hideUntilNextNonGroup = hidden;
        activeKey = key;
        continue;
      }
      if (hideUntilNextNonGroup) {
        const lineKey = lineInstanceKey(row.line);
        if (lineKey === activeKey) continue;
        hideUntilNextNonGroup = false;
        activeKey = null;
      }
      out.push(row);
    }
    return out;
  }, [allRows, collapsedInstances]);

  const groupsById = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g])), [groups]);

  const renderRow = useCallback(
    (_: number, row: EffectiveRow) => {
      if (row.kind === "group-header") {
        const group = groupsById.get(row.groupId);
        if (!group) return <div style={{ height: GROUP_HEADER_HEIGHT }} />;
        return (
          <GroupHeaderRow
            group={group}
            instanceIdx={row.instanceIdx}
            ordinal={row.ordinal}
            totalInstances={row.totalInstances}
            instanceStart={row.instanceStart}
            instanceEnd={row.instanceEnd}
          />
        );
      }
      return (
        <LineRow
          line={row.line}
          lineIndex={row.lineIndex}
          duration={duration}
          onUpdateWord={handleUpdateWord}
          onUpdateBgWord={handleUpdateBgWord}
        />
      );
    },
    [groupsById, duration],
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
