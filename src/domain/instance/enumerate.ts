import type { LyricLine } from "@/stores/project";

// -- Functions ----------------------------------------------------------------

function linesOfInstance(lines: ReadonlyArray<LyricLine>, groupId: string, instanceIdx: number): LyricLine[] {
  return lines.filter((line) => line.groupId === groupId && line.instanceIdx === instanceIdx);
}

// -- Exports ------------------------------------------------------------------

export { linesOfInstance };
