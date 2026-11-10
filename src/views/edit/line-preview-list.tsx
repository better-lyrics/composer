import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { useIsActiveTab } from "@/hooks/use-is-active-tab";
import { useSettingsStore } from "@/stores/settings";
import { pluralize } from "@/utils/pluralize";
import {
  LinePreview,
  type LinePreviewRowHandlers,
  PREVIEW_GROUP_HEADER_HEIGHT,
  PREVIEW_ROW_HEIGHT,
  PreviewGroupHeader,
} from "@/views/edit/line-preview";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LinePreviewListProps extends LinePreviewRowHandlers {
  parsed: readonly ParsedLine[];
  lines: readonly LyricLine[];
  groups: readonly LinkGroup[];
  agents: Agent[];
  selectedLines: ReadonlySet<number>;
  onBulkAgentChange: (agentId: string) => void;
}

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

function listHeight(parsed: readonly ParsedLine[], groupsById: ReadonlyMap<string, LinkGroup>): number {
  let height = parsed.length * PREVIEW_ROW_HEIGHT;
  parsed.forEach((line, index) => {
    if (line.groupId && groupsById.has(line.groupId) && startsInstance(parsed, index)) {
      height += PREVIEW_GROUP_HEADER_HEIGHT;
    }
  });
  return height;
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
  const isShown = useIsActiveTab("edit");

  if (!isShown) return <div style={{ height: listHeight(parsed, groupsById) }} />;

  return (
    <div>
      {parsed.map((line, index) => {
        const isFirstOfInstance = startsInstance(parsed, index);
        const group = line.groupId ? groupsById.get(line.groupId) : undefined;
        const position = group ? positions.get(line.lineId) : undefined;
        const totalInstances = position?.count ?? 0;
        const groupTooltip =
          group && totalInstances > 1
            ? `Part of ${group.label} · linked to ${pluralize(totalInstances - 1, "other instance")}. Edits propagate.`
            : undefined;
        const isSelected = selectedLines.has(line.lineNumber);
        return (
          <div key={line.lineNumber}>
            {isFirstOfInstance && group && position && (
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
          </div>
        );
      })}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { LinePreviewList };
