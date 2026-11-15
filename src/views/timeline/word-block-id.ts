import type { LyricLine } from "insync/line";
import type { WordTrack } from "insync/line-track";
import type { SyllableAddress } from "insync/selection-model";
import { resolveAddress } from "@/domain/selection/resolve";
import { getSplitCharacter } from "@/utils/split-character";

// -- Functions ----------------------------------------------------------------

// Index based on purpose: tests and overlays find a block by its place in the track.
function wordBlockId(lineId: string, type: WordTrack, wordIndex: number): string {
  return `${lineId}-${type}-${wordIndex}`;
}

function addressedBlockId(lines: readonly LyricLine[], address: SyllableAddress): string | null {
  const resolved = resolveAddress(lines, address, getSplitCharacter());
  return resolved ? wordBlockId(resolved.lineId, resolved.type, resolved.wordIndex) : null;
}

// -- Exports ------------------------------------------------------------------

export { addressedBlockId, wordBlockId };
