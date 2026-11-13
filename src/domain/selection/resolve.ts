import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import type { SyllableAddress } from "@/domain/selection/model";
import type { WordTiming } from "@/domain/word/timing";
import { memoByIdentity } from "@/utils/memo-by-identity";

// -- Types --------------------------------------------------------------------

// Where an address sits in one lines array; valid only for that array.
interface ResolvedAddress extends SyllableAddress {
  lineIndex: number;
  wordIndex: number;
}

// -- State --------------------------------------------------------------------

const lineIndexCache = new WeakMap<readonly LyricLine[], Map<string, number>>();

// Keyed by track array, so resolving a whole selection reads each track once.
const wordIndexById = memoByIdentity(
  (words: readonly WordTiming[]) => new Map(words.map((word, index) => [word.id, index])),
);

// -- Functions ----------------------------------------------------------------

function lineIndexById(lines: readonly LyricLine[]): Map<string, number> {
  let byId = lineIndexCache.get(lines);
  if (!byId) {
    byId = new Map(lines.map((line, index) => [line.id, index]));
    lineIndexCache.set(lines, byId);
  }
  return byId;
}

function resolveLineIndex(lines: readonly LyricLine[], lineId: string): number | undefined {
  return lineIndexById(lines).get(lineId);
}

function addressOf(line: Pick<LyricLine, "id">, type: WordTrack, word: Pick<WordTiming, "id">): SyllableAddress {
  return { lineId: line.id, type, syllableId: word.id };
}

function toAddress({ lineId, type, syllableId }: SyllableAddress): SyllableAddress {
  return { lineId, type, syllableId };
}

function resolvedAt(
  lines: readonly LyricLine[],
  lineIndex: number,
  type: WordTrack,
  wordIndex: number,
): ResolvedAddress | null {
  const line = lines[lineIndex];
  const word = line ? effectiveTrackWords(line, type)?.[wordIndex] : undefined;
  return word ? { lineId: line.id, type, syllableId: word.id, lineIndex, wordIndex } : null;
}

// For transient index-based input (drag data, keyboard traversal), named the way a selection names it.
function addressAt(
  lines: readonly LyricLine[],
  lineId: string,
  type: WordTrack,
  wordIndex: number,
): ResolvedAddress | null {
  const lineIndex = lineIndexById(lines).get(lineId);
  return lineIndex === undefined ? null : resolvedAt(lines, lineIndex, type, wordIndex);
}

function resolveAddress(lines: readonly LyricLine[], address: SyllableAddress): ResolvedAddress | null {
  const lineIndex = lineIndexById(lines).get(address.lineId);
  if (lineIndex === undefined) return null;
  const words = effectiveTrackWords(lines[lineIndex], address.type);
  const wordIndex = words && wordIndexById(words).get(address.syllableId);
  if (wordIndex === undefined) return null;
  const { lineId, type, syllableId } = address;
  return { lineId, type, syllableId, lineIndex, wordIndex };
}

function resolveAddresses(lines: readonly LyricLine[], addresses: readonly SyllableAddress[]): ResolvedAddress[] {
  return addresses.flatMap((address) => resolveAddress(lines, address) ?? []);
}

function wordAt(lines: readonly LyricLine[], address: SyllableAddress): WordTiming | null {
  const lineIndex = lineIndexById(lines).get(address.lineId);
  if (lineIndex === undefined) return null;
  return effectiveTrackWords(lines[lineIndex], address.type)?.find((word) => word.id === address.syllableId) ?? null;
}

// The same array when every address still resolves, so subscribers see no change.
function liveAddresses<A extends SyllableAddress>(lines: readonly LyricLine[], addresses: A[]): A[] {
  const live = addresses.filter((address) => resolveAddress(lines, address) !== null);
  return live.length === addresses.length ? addresses : live;
}

// -- Exports ------------------------------------------------------------------

export type { ResolvedAddress };
export {
  addressAt,
  addressOf,
  liveAddresses,
  resolveAddress,
  resolveAddresses,
  resolvedAt,
  resolveLineIndex,
  toAddress,
  wordAt,
};
