import { useProjectStore, type LinkGroup } from "@/stores/project";
import { GroupBanner } from "@/views/timeline/group-banner";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { memo, useCallback, useEffect, useRef, useState } from "react";

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
  const clearContextMenu = useTimelineStore((s) => s.clearContextMenu);
  const renamingGroupId = useTimelineStore((s) => s.renamingGroupId);
  const renamingInstanceIdx = useTimelineStore((s) => s.renamingInstanceIdx);
  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);
  const isCollapsed = collapsedInstances[`${group.id}:${instanceIdx}`] ?? false;
  const renaming = renamingGroupId === group.id && renamingInstanceIdx === instanceIdx;
  const [renameValue, setRenameValue] = useState(() => group.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setRenameValue(group.label);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming, group.label]);

  const openGroupMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: { kind: "group-banner", groupId: group.id, instanceIdx, source: "gutter" },
      });
    },
    [group.id, instanceIdx, setContextMenu],
  );

  const startRename = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearContextMenu();
      setRenamingGroupId(group.id, instanceIdx);
    },
    [clearContextMenu, group.id, instanceIdx, setRenamingGroupId],
  );

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0 && trimmed !== group.label) {
      useProjectStore.getState().updateGroup(group.id, { label: trimmed });
    }
    setRenamingGroupId(null);
  }, [renameValue, group.id, group.label, setRenamingGroupId]);

  const cancelRename = useCallback(() => {
    setRenamingGroupId(null);
    setRenameValue(group.label);
  }, [group.label, setRenamingGroupId]);

  return (
    <div
      className="relative flex"
      style={{ height: GROUP_HEADER_HEIGHT }}
      data-group-header={`${group.id}:${instanceIdx}`}
      onDoubleClick={renaming ? undefined : startRename}
    >
      <div
        className="shrink-0 w-12 sticky left-0 z-[60] flex items-center justify-center px-1 select-none overflow-hidden border-r-2"
        style={{
          background: `color-mix(in srgb, ${group.color} 30%, var(--color-composer-bg))`,
          borderRightColor: group.color,
          boxShadow: `0 -1px 0 0 color-mix(in srgb, ${group.color} 40%, var(--color-composer-border)), inset 0 -1px 0 0 color-mix(in srgb, ${group.color} 35%, var(--color-composer-border)), 10px 0 15px -3px rgb(0 0 0 / 0.1), 4px 0 6px -4px rgb(0 0 0 / 0.1)`,
        }}
      >
        {renaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") cancelRename();
              e.stopPropagation();
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-[10px] font-semibold text-composer-text text-center leading-none focus:outline-none px-0"
          />
        ) : (
          <button
            type="button"
            onClick={openGroupMenu}
            onContextMenu={openGroupMenu}
            className="w-full h-full flex items-center justify-center cursor-pointer hover:brightness-110 transition-[filter]"
            title={`${group.label} · ${instanceIdx + 1} of ${totalInstances}`}
          >
            <span className="text-[10px] font-semibold text-composer-text truncate w-full text-center leading-none">
              {group.label}
            </span>
          </button>
        )}
      </div>
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
