import type { LinkGroup } from "@/stores/project";
import { GroupBanner } from "@/views/timeline/group-banner";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { memo, useCallback } from "react";

// -- Types ---------------------------------------------------------------------

interface GroupHeaderRowProps {
  group: LinkGroup;
  instanceIdx: number;
  totalInstances: number;
  instanceStart: number;
  instanceEnd: number;
}

// -- Constants -----------------------------------------------------------------

const GROUP_HEADER_HEIGHT = 38;

// -- Component -----------------------------------------------------------------

const GroupHeaderRowComponent: React.FC<GroupHeaderRowProps> = ({
  group,
  instanceIdx,
  totalInstances,
  instanceStart,
  instanceEnd,
}) => {
  const zoom = useTimelineStore((s) => s.zoom);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const setContextMenu = useTimelineStore((s) => s.setContextMenu);
  const isCollapsed = collapsedInstances[`${group.id}:${instanceIdx}`] ?? false;

  const openGroupMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: { kind: "group-banner", groupId: group.id, instanceIdx },
      });
    },
    [group.id, instanceIdx, setContextMenu],
  );

  return (
    <div
      className="relative flex"
      style={{ height: GROUP_HEADER_HEIGHT }}
      data-group-header={`${group.id}:${instanceIdx}`}
    >
      <button
        type="button"
        onClick={openGroupMenu}
        onContextMenu={openGroupMenu}
        className="shrink-0 w-12 sticky left-0 z-[60] flex items-center justify-center px-1 select-none overflow-hidden border-r-2 cursor-pointer hover:brightness-110 transition-[filter]"
        style={{
          background: `color-mix(in srgb, ${group.color} 30%, var(--color-composer-bg))`,
          borderRightColor: group.color,
          boxShadow: `0 -1px 0 0 color-mix(in srgb, ${group.color} 40%, var(--color-composer-border)), inset 0 -1px 0 0 color-mix(in srgb, ${group.color} 35%, var(--color-composer-border)), 10px 0 15px -3px rgb(0 0 0 / 0.1), 4px 0 6px -4px rgb(0 0 0 / 0.1)`,
        }}
        title={`${group.label} · ${instanceIdx + 1} of ${totalInstances}`}
      >
        <span className="text-[10px] font-semibold text-composer-text truncate w-full text-center leading-none">
          {group.label}
        </span>
      </button>
      <div className="flex-1 overflow-hidden border-b border-composer-border relative">
        <GroupBanner
          group={group}
          instanceIdx={instanceIdx}
          totalInstances={totalInstances}
          instanceStart={instanceStart}
          instanceEnd={instanceEnd}
          isCollapsed={isCollapsed}
          zoom={zoom}
        />
      </div>
    </div>
  );
};

const GroupHeaderRow = memo(GroupHeaderRowComponent);

// -- Exports -------------------------------------------------------------------

export { GroupHeaderRow, GROUP_HEADER_HEIGHT };
export type { GroupHeaderRowProps };
