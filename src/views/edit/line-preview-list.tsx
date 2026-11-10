import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { instancePositionsByLineId } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { pluralize } from "@/utils/pluralize";
import { LinePreview, PreviewGroupHeader } from "@/views/edit/line-preview";
import type { ParsedLine } from "@/views/edit/parse-lyrics";
import { useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LinePreviewListProps {
  parsed: readonly ParsedLine[];
  lines: readonly LyricLine[];
  groups: readonly LinkGroup[];
  agents: Agent[];
  selectedLines: ReadonlySet<number>;
  onSelect: (lineNumber: number, shiftKey: boolean) => void;
  onAgentChange: (lineId: string, agentId: string) => void;
  onBulkAgentChange: (agentId: string) => void;
  onBackgroundChange: (lineId: string, text: string) => void;
  onExtractLine: (lineId: string) => void;
  onGutterMouseDown: (lineNumber: number, e: React.MouseEvent) => void;
  onGutterMouseEnter: (lineNumber: number, e: React.MouseEvent) => void;
  didDragRef: React.MutableRefObject<boolean>;
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

  return (
    <div>
      {parsed.map((line, index) => {
        const prev = index > 0 ? parsed[index - 1] : null;
        const isFirstOfInstance =
          line.groupId !== undefined &&
          line.instanceIdx !== undefined &&
          (prev?.groupId !== line.groupId || prev?.instanceIdx !== line.instanceIdx);
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
