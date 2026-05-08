import { type LinkGroup, useProjectStore } from "@/stores/project";
import { groupPingVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getWordsInInstance } from "@/views/timeline/utils";
import { IconChevronDown, IconLink } from "@tabler/icons-react";
import { motion } from "motion/react";
import { memo, useCallback, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface GroupBannerProps {
  group: LinkGroup;
  instanceIdx: number;
  totalInstances: number;
  instanceStart: number;
  instanceEnd: number;
  isCollapsed: boolean;
  zoom: number;
}

// -- Constants -----------------------------------------------------------------

const BANNER_VERTICAL_INSET = 4;
const BANNER_MIN_WIDTH = 80;
const DRAG_THRESHOLD_PX = 3;

// -- Component -----------------------------------------------------------------

const GroupBannerComponent: React.FC<GroupBannerProps> = ({
  group,
  instanceIdx,
  totalInstances,
  instanceStart,
  instanceEnd,
  isCollapsed,
  zoom,
}) => {
  const pingingGroupId = useTimelineStore((s) => s.pingingGroupId);
  const isPinging = pingingGroupId === group.id;
  const setSelectedWords = useTimelineStore((s) => s.setSelectedWords);

  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; moved: boolean; cleanup: () => void } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const startX = e.clientX;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!dragStateRef.current) return;
        if (!dragStateRef.current.moved && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          dragStateRef.current.moved = true;
          setIsDragging(true);
        }
        if (dragStateRef.current.moved) {
          setDragOffsetPx(dx);
        }
      };

      const handleUp = (upEvent: PointerEvent) => {
        const wasDrag = dragStateRef.current?.moved ?? false;
        const dx = upEvent.clientX - startX;
        const cleanup = dragStateRef.current?.cleanup;
        dragStateRef.current = null;
        cleanup?.();
        setIsDragging(false);
        setDragOffsetPx(0);

        if (wasDrag && useProjectStore.getState().groups.find((g) => g.id === group.id)) {
          const deltaSeconds = dx / zoom;
          if (Math.abs(deltaSeconds) > 0.001) {
            useProjectStore.getState().shiftInstance(group.id, instanceIdx, deltaSeconds);
          }
        } else {
          // treat as click: select all instance words
          const lines = useProjectStore.getState().lines;
          setSelectedWords(getWordsInInstance(lines, group.id, instanceIdx));
        }
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };

      dragStateRef.current = { startX, moved: false, cleanup };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [group.id, instanceIdx, setSelectedWords, zoom],
  );

  const setPingingGroupId = useTimelineStore((s) => s.setPingingGroupId);
  const handleBadgeMouseEnter = useCallback(() => setPingingGroupId(group.id), [group.id, setPingingGroupId]);
  const handleBadgeMouseLeave = useCallback(() => setPingingGroupId(null), [setPingingGroupId]);

  const toggleInstanceCollapsed = useTimelineStore((s) => s.toggleInstanceCollapsed);
  const setContextMenu = useTimelineStore((s) => s.setContextMenu);
  const handleChevronPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);
  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleInstanceCollapsed(`${group.id}:${instanceIdx}`);
    },
    [group.id, instanceIdx, toggleInstanceCollapsed],
  );

  const handleContextMenu = useCallback(
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

  const setRenamingGroupId = useTimelineStore((s) => s.setRenamingGroupId);
  const handleLabelDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target: { kind: "group-banner", groupId: group.id, instanceIdx },
      });
      setRenamingGroupId(group.id);
    },
    [group.id, instanceIdx, setContextMenu, setRenamingGroupId],
  );

  const left = instanceStart * zoom;
  const width = Math.max(BANNER_MIN_WIDTH, (instanceEnd - instanceStart) * zoom);
  const deltaSecondsLive = dragOffsetPx / Math.max(zoom, 1);

  return (
    <motion.div
      data-banner-progress=""
      data-instance-key={`${group.id}:${instanceIdx}`}
      data-instance-start={instanceStart}
      data-instance-end={instanceEnd}
      variants={groupPingVariants}
      animate={isPinging ? "ping" : "idle"}
      className={cn(
        "absolute flex items-center gap-1 rounded-md cursor-grab select-none pl-1.5 pr-2.5",
        "border text-[10px] font-medium text-composer-text z-[45]",
      )}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      style={{
        left,
        width,
        top: BANNER_VERTICAL_INSET,
        bottom: BANNER_VERTICAL_INSET,
        background: `color-mix(in srgb, ${group.color} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${group.color} 60%, transparent)`,
        transform: isDragging ? `translateX(${dragOffsetPx}px)` : undefined,
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <button
        type="button"
        aria-label={isCollapsed ? "Expand instance" : "Collapse instance"}
        onClick={handleChevronClick}
        onPointerDown={handleChevronPointerDown}
        className="shrink-0 cursor-pointer opacity-70 hover:opacity-100 transition-opacity p-0.5"
      >
        <IconChevronDown
          className={cn("w-3 h-3 transition-transform duration-200 ease-out", isCollapsed && "-rotate-90")}
        />
      </button>
      <span className="font-semibold whitespace-nowrap" onDoubleClick={handleLabelDoubleClick}>
        {group.label}
      </span>
      <span
        className="flex items-center gap-1 text-composer-text-muted tabular-nums whitespace-nowrap ml-auto"
        onMouseEnter={handleBadgeMouseEnter}
        onMouseLeave={handleBadgeMouseLeave}
      >
        <IconLink className="w-2.5 h-2.5" />
        {instanceIdx + 1} of {totalInstances}
        {isDragging && (
          <span className="ml-1 text-composer-text">
            {deltaSecondsLive >= 0 ? "+" : ""}
            {deltaSecondsLive.toFixed(1)}s
          </span>
        )}
      </span>
      {isCollapsed && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-md pointer-events-none overflow-hidden"
          style={{
            background: `linear-gradient(to right, color-mix(in srgb, ${group.color} 35%, transparent) var(--progress-fill, 0%), transparent var(--progress-fill, 0%))`,
          }}
        />
      )}
    </motion.div>
  );
};

const GroupBanner = memo(GroupBannerComponent);

// -- Exports -------------------------------------------------------------------

export { GroupBanner };
export type { GroupBannerProps };
