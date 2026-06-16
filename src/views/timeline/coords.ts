import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";

const REVEAL_MARGIN_PX = 48;

const timeToX = (time: number, zoom: number, scrollLeft: number): number => time * zoom - scrollLeft + GUTTER_WIDTH;

const xToTime = (clientX: number, rect: DOMRect, zoom: number, scrollLeft: number): number =>
  Math.max(0, (clientX - rect.left - GUTTER_WIDTH + scrollLeft) / zoom);

const revealTimeScrollLeft = (
  time: number,
  zoom: number,
  scrollLeft: number,
  clientWidth: number,
  margin = REVEAL_MARGIN_PX,
): number | null => {
  const x = time * zoom;
  const visibleStart = scrollLeft;
  const visibleEnd = scrollLeft + clientWidth - GUTTER_WIDTH;
  if (x >= visibleStart + margin && x <= visibleEnd - margin) return null;
  return Math.max(0, x + GUTTER_WIDTH - clientWidth / 2);
};

export { GUTTER_WIDTH, REVEAL_MARGIN_PX, revealTimeScrollLeft, timeToX, xToTime };
