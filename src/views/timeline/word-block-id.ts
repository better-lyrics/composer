import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddress } from "@/domain/selection/resolve";

// -- Functions ----------------------------------------------------------------

// Index based on purpose: tests and overlays find a block by its place in the track.
function wordBlockId(lineId: string, type: WordTrack, wordIndex: number): string {
  return `${lineId}-${type}-${wordIndex}`;
}

function addressedBlockId(lines: readonly LyricLine[], address: SyllableAddress): string | null {
  const resolved = resolveAddress(lines, address);
  return resolved ? wordBlockId(resolved.lineId, resolved.type, resolved.wordIndex) : null;
}

// -- Exports ------------------------------------------------------------------

export { addressedBlockId, wordBlockId };
