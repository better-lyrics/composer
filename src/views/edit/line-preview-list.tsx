import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { useScrollParent } from "@/hooks/use-scroll-parent";
import { useSettingsStore } from "@/stores/settings";
import { ListScroll } from "@/ui/scroll";
import { pluralize } from "@/utils/pluralize";
import {
  LinePreview,
  type LinePreviewRowHandlers,
  PREVIEW_ROW_HEIGHT,
  PreviewGroupHeader,
} from "@/views/edit/line-preview";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";

// -- Interfaces ---------------------------------------------------------------

interface LinePreviewListProps extends LinePreviewRowHandlers {
  parsed: readonly ParsedLine[];
  lines: readonly LyricLine[];
  groups: readonly LinkGroup[];
  agents: Agent[];
  selectedLines: ReadonlySet<number>;
  onBulkAgentChange: (agentId: string) => void;
}

// -- Constants ----------------------------------------------------------------

const MOUNTED_BEYOND_VIEWPORT_PX = 600;

// -- Helpers ------------------------------------------------------------------

function startsInstance(parsed: readonly ParsedLine[], index: number): boolean {
  const line = parsed[index];
  const prev = index > 0 ? parsed[index - 1] : null;
  return (
    line.groupId !== undefined &&
    line.instanceIdx !== undefined &&
    (prev?.groupId !== line.groupId || prev?.instanceIdx !== line.instanceIdx)
  );
}

function hasNoLyrics(parsed: readonly ParsedLine[]): boolean {
  return parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty);
}

// Blank text lines carry no line id; a lyric keeps its row while lines above it are added or removed.
function rowKey(_index: number, line: ParsedLine): string {
  return line.lineId || `blank:${line.lineNumber}`;
}

// -- Components ---------------------------------------------------------------

const LinePreviewList: React.FC<LinePreviewListProps> = ({
  parsed,
  lines,
  groups,
  agents,
  selectedLines,
  onBulkAgentChange,
  ...rowHandlers
}) => {
  const positions = useMemo(() => instancePositionsByLineId(lines), [lines]);
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const editsSelection = selectedLines.size > 1;
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const [scrollParent, keepScrollParent] = useScrollParent();

  const renderRow = (index: number, line: ParsedLine) => {
    const group = line.groupId ? groupsById.get(line.groupId) : undefined;
    const position = group ? positions.get(line.lineId) : undefined;
    const totalInstances = position?.count ?? 0;
    const groupTooltip =
      group && totalInstances > 1
        ? `Part of ${group.label} · linked to ${pluralize(totalInstances - 1, "other instance")}. Edits propagate.`
        : undefined;
    const isSelected = selectedLines.has(line.lineNumber);
    return (
      <>
        {group && position && startsInstance(parsed, index) && (
          <PreviewGroupHeader
            label={group.label}
            ordinal={position.ordinal}
            total={totalInstances}
            color={group.color}
          />
        )}
        <LinePreview
          line={line}
          agents={agents}
          isSelected={isSelected}
          splitCharacter={splitCharacter}
          groupColor={group?.color}
          groupTooltip={groupTooltip}
          onBulkAgentChange={isSelected && editsSelection ? onBulkAgentChange : undefined}
          {...rowHandlers}
        />
      </>
    );
  };

  return (
    <ListScroll className="flex-1 border rounded-xl border-(--edge) bg-(--well)" scrollParentRef={keepScrollParent}>
      {hasNoLyrics(parsed) ? (
        <div className="flex items-center justify-center h-full text-sm text-(--muted)">Lyrics will appear here</div>
      ) : (
        scrollParent && (
          <Virtuoso
            data={parsed}
            computeItemKey={rowKey}
            itemContent={renderRow}
            customScrollParent={scrollParent}
            defaultItemHeight={PREVIEW_ROW_HEIGHT}
            increaseViewportBy={MOUNTED_BEYOND_VIEWPORT_PX}
          />
        )
      )}
    </ListScroll>
  );
};

// -- Exports ------------------------------------------------------------------

export { LinePreviewList };
