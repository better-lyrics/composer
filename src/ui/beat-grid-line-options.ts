import type { GridLines } from "@/domain/tempo/grid-points";

const BEAT_GRID_LINE_OPTIONS: readonly { value: GridLines; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "1", label: "Beat" },
  { value: "2", label: "1/2" },
  { value: "3", label: "1/3" },
  { value: "4", label: "1/4" },
];

export { BEAT_GRID_LINE_OPTIONS };
