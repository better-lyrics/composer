import { forgetPlayedSpans } from "@/audio/playback-ranges";
import { fingerprintChanged } from "@/domain/alignment/fingerprint";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";

// -- Functions ----------------------------------------------------------------

function recordRealignedLines(before: ReadonlyMap<string, LyricLine>): void {
  const project = useProjectStore.getState();
  const realigned = project.lines.filter((line) => fingerprintChanged(before.get(line.id), line));
  forgetPlayedSpans(realigned.flatMap((line) => effectiveBounds(line) ?? []));
  project.recordAlignedTimings(realigned.map((line) => line.id));
}

// -- Exports ------------------------------------------------------------------

export { recordRealignedLines };
