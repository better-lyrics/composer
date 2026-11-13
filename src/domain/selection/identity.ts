import type { WordTrack } from "@/domain/line/tracks";
import type { SyllableAddress } from "@/domain/selection/model";

// -- Identity -----------------------------------------------------------------

function sameAddress(a: SyllableAddress, b: SyllableAddress): boolean {
  return a.syllableId === b.syllableId && a.lineId === b.lineId && a.type === b.type;
}

function isAddressed(
  addresses: readonly SyllableAddress[],
  lineId: string,
  type: WordTrack,
  syllableId: string,
): boolean {
  return addresses.some((a) => a.syllableId === syllableId && a.lineId === lineId && a.type === type);
}

// -- Exports ------------------------------------------------------------------

export { isAddressed, sameAddress };
