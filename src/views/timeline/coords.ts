import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";

const timeToX = (time: number, zoom: number, scrollLeft: number): number => time * zoom - scrollLeft + GUTTER_WIDTH;

const xToTime = (clientX: number, rect: DOMRect, zoom: number, scrollLeft: number): number =>
  Math.max(0, (clientX - rect.left - GUTTER_WIDTH + scrollLeft) / zoom);

export { GUTTER_WIDTH, timeToX, xToTime };
