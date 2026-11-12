import { lineInstanceKey } from "@/domain/instance/key";
import type { ReadableLine } from "@/domain/line/effective-words";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { computeRowLayout } from "@/views/timeline/utils";
import { scrollView } from "@/views/timeline/view-scroll";

// -- Functions ----------------------------------------------------------------

function centreLineRow(container: HTMLElement, lines: ReadableLine[], line: ReadableLine): void {
  const { rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
  const layout = computeRowLayout({
    lines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    focusedGroup,
    waveformHeight: currentOverviewBandHeight(),
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });
  const headerKey = lineInstanceKey(line);
  const pos =
    headerKey && collapsedInstances[headerKey] ? layout.headerTops.get(headerKey) : layout.lineTops.get(line.id);
  if (!pos) return;

  const viewportHeight = container.clientHeight;
  const rowCenter = pos.top + pos.height / 2;
  const targetTop = Math.max(0, Math.min(container.scrollHeight - viewportHeight, rowCenter - viewportHeight / 2));
  scrollView(container, null, targetTop);
}

// -- Exports ------------------------------------------------------------------

export { centreLineRow };
