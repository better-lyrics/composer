import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { tempoSections } from "@/domain/tempo/tempo-sections";
import { formatBpm } from "@/utils/format-bpm";
import { usePlayheadBeat } from "@/views/timeline/beat-grid/use-playhead-beat";
import { useMemo, useState } from "react";

// -- Hook ----------------------------------------------------------------------

function usePlayheadTempo(grid: BeatGrid, label: string, songBpm: number): string {
  const sections = useMemo(() => tempoSections(grid), [grid]);
  const [playheadBpm, setPlayheadBpm] = useState<string | null>(null);

  usePlayheadBeat(sections.length > 1 ? grid : null, label, (index, changed) => {
    if (!changed) return;
    const section = sections.findLast((candidate) => candidate.from <= index) ?? sections[0];
    const next = formatBpm(section.bpm);
    if (next !== playheadBpm) setPlayheadBpm(next);
  });

  return sections.length > 1 ? (playheadBpm ?? formatBpm(sections[0].bpm)) : formatBpm(songBpm);
}

// -- Exports -------------------------------------------------------------------

export { usePlayheadTempo };
