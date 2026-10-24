import { keepsOwnTiming, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { useProjectStore } from "@/stores/project";
import { IconButton } from "@/ui/icon-button";
import { buildGroupPingVariants } from "@/utils/animationVariants";
import { cn } from "@/utils/cn";
import { registerBanner } from "@/views/timeline/banner-progress-registry";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useBannerDrag } from "@/views/timeline/use-banner-drag";
import { IconChevronDown, IconClock, IconLink } from "@tabler/icons-react";
import { m } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

// -- Types ---------------------------------------------------------------------

interface GroupBannerProps {
  group: LinkGroup;
  instanceIdx: number;
  ordinal: number;
  totalInstances: number;
  instanceStart: number;
  instanceEnd: number;
  isCollapsed: boolean;
  zoom: number;
}

// -- Constants -----------------------------------------------------------------

const BANNER_MIN_WIDTH = 80;

// -- Component -----------------------------------------------------------------

const GroupBannerComponent: React.FC<GroupBannerProps> = ({
  group,
  instanceIdx,
  ordinal,
  totalInstances,
  instanceStart,
  instanceEnd,
  isCollapsed,
  zoom,
}) => {
  const pingingGroupId = useTimelineStore((s) => s.pingingGroupId);
  const isPinging = pingingGroupId === group.id;
  const pingVariants = useMemo(() => buildGroupPingVariants(group.color), [group.color]);
  const { dragOffsetPx, isDragging, handlePointerDown } = useBannerDrag({
    groupId: group.id,
    instanceIdx,
    instanceStart,
    instanceEnd,
    zoom,
  });
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = bannerRef.current;
    if (!node) return;
    return registerBanner(node);
  }, []);

  const setPingingGroupId = useTimelineStore((s) => s.setPingingGroupId);
  const handleBadgeMouseEnter = useCallback(() => setPingingGroupId(group.id), [group.id, setPingingGroupId]);
  const handleBadgeMouseLeave = useCallback(() => setPingingGroupId(null), [setPingingGroupId]);

  const openGroup = useTimelineStore((s) => s.openGroup);
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openGroup(group.id, instanceIdx);
    },
    [group.id, instanceIdx, openGroup],
  );

  const setContextMenu = useTimelineStore((s) => s.setContextMenu);
  const toggleInstanceCollapsed = useTimelineStore((s) => s.toggleInstanceCollapsed);
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
        target: { kind: "group-banner", groupId: group.id, instanceIdx, source: "banner" },
      });
    },
    [group.id, instanceIdx, setContextMenu],
  );

  const isShared = sharesTiming(group, instanceIdx);
  const hasOwnTiming = keepsOwnTiming(group, instanceIdx);
  const left = instanceStart * zoom;
  const width = Math.max(BANNER_MIN_WIDTH, (instanceEnd - instanceStart) * zoom);
  const deltaSecondsLive = dragOffsetPx / Math.max(zoom, 1);

  // Reactive subscription to lines so word edits inside a collapsed banner
  // update the tick positions automatically. Filter in useMemo to avoid
  // returning a new array reference from the store selector (which would
  // cause infinite re-renders).
  const allLines = useProjectStore((s) => s.lines);
  const wordTicks = useMemo(() => {
    if (!isCollapsed) return [];
    const span = instanceEnd - instanceStart;
    if (span <= 0) return [];
    const ticks: Array<{ idx: number; leftPct: number; widthPct: number }> = [];
    for (const line of allLines) {
      if (line.groupId !== group.id || line.instanceIdx !== instanceIdx) continue;
      if (!line.words?.length) continue;
      for (const w of line.words) {
        const startPct = ((w.begin - instanceStart) / span) * 100;
        const endPct = ((w.end - instanceStart) / span) * 100;
        const widthPct = Math.max(0.4, endPct - startPct);
        ticks.push({ idx: ticks.length, leftPct: startPct, widthPct });
      }
    }
    return ticks;
  }, [isCollapsed, instanceStart, instanceEnd, allLines, group.id, instanceIdx]);

  return (
    <m.div
      ref={bannerRef}
      data-banner-progress=""
      data-instance-key={`${group.id}:${instanceIdx}`}
      data-instance-start={instanceStart}
      data-instance-end={instanceEnd}
      variants={pingVariants}
      animate={isPinging ? "ping" : "idle"}
      className={cn(
        "absolute top-1 bottom-1 flex items-center gap-1.5 rounded-[7px] select-none pl-1 pr-2 z-[30]",
        "text-[11.5px] font-semibold leading-none text-composer-text banner-elevation",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={handlePointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      style={{
        left,
        width,
        background: `linear-gradient(to bottom, color-mix(in oklab, var(--ink) 4%, transparent), transparent 60%), color-mix(in oklab, ${group.color} 24%, var(--word-face))`,
        transform: isDragging ? `translateX(${dragOffsetPx}px)` : undefined,
      }}
    >
      <IconButton
        label={isCollapsed ? "Expand instance" : "Collapse instance"}
        icon={<IconChevronDown className={cn("size-[13px]", isCollapsed && "-rotate-90")} />}
        variant="ghost"
        onClick={handleChevronClick}
        onPointerDown={handleChevronPointerDown}
        onDoubleClick={(e) => e.stopPropagation()}
        className="shrink-0 w-auto h-auto p-0.5 opacity-70 hover:opacity-100 hover:bg-transparent text-current relative before:content-[''] before:absolute before:-inset-2"
      />
      <span className="min-w-0 truncate">{group.label}</span>
      {hasOwnTiming && (
        <span className="flex min-w-0 items-center gap-0.5 overflow-hidden rounded-full border border-dashed border-composer-text-faint py-px pl-1 pr-1.5 text-composer-text-tertiary whitespace-nowrap">
          <IconClock className="size-2.5 shrink-0" />
          <span className="truncate">Own timing</span>
        </span>
      )}
      <span
        className="flex items-center gap-[3px] font-medium text-composer-text/65 tabular-nums whitespace-nowrap ml-auto"
        onMouseEnter={handleBadgeMouseEnter}
        onMouseLeave={handleBadgeMouseLeave}
      >
        <IconLink className="size-[13px]" style={isShared ? { color: group.color } : undefined} />
        {ordinal} of {totalInstances}
        {isDragging && (
          <span className="ml-1 text-composer-text">
            {deltaSecondsLive >= 0 ? "+" : ""}
            {deltaSecondsLive.toFixed(1)}s
          </span>
        )}
      </span>
      {isCollapsed && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 rounded-[7px] pointer-events-none overflow-hidden"
            style={{
              background: `linear-gradient(to right, color-mix(in srgb, ${group.color} 35%, transparent) var(--progress-fill, 0%), transparent var(--progress-fill, 0%))`,
            }}
          />
          <span
            aria-hidden
            className="absolute left-1.5 right-1.5 bottom-0.5 h-[3px] pointer-events-none overflow-hidden"
          >
            {wordTicks.map((t) => (
              <span
                key={`${t.idx}-${t.leftPct}-${t.widthPct}`}
                className="absolute top-0 bottom-0 rounded-[1px]"
                style={{
                  left: `${t.leftPct}%`,
                  width: `${t.widthPct}%`,
                  background: group.color,
                  opacity: 0.6,
                }}
              />
            ))}
          </span>
        </>
      )}
    </m.div>
  );
};

const GroupBanner = memo(GroupBannerComponent);

// -- Exports -------------------------------------------------------------------

export { GroupBanner };
