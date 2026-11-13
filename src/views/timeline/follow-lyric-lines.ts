import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveLineIndex } from "@/domain/selection/resolve";
import { isInQueueOrder, queueOrder } from "@/domain/step-timing/step-queue";
import { onLyricsChanged } from "@/stores/project/lyric-change-listeners";
import { memoByIdentity } from "@/utils/memo-by-identity";
import { selectionPatch } from "@/views/timeline/step-timing/step-selection";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type TimelineState = ReturnType<typeof useTimelineStore.getState>;
type AddressedState = Pick<
  TimelineState,
  "stepTiming" | "selectedWords" | "stepQueue" | "editingWord" | "loupeTarget" | "contextMenu"
>;
type AddressedPatch = Partial<Pick<TimelineState, keyof AddressedState | "loopRegion">>;

// -- State --------------------------------------------------------------------

// Where each addressed line was last found, so an edit that moves no line never indexes every line.
const lineIndexHints = new Map<string, number>();

const trackWordIds: Record<WordTrack, (line: LyricLine) => ReadonlySet<string>> = {
  word: memoByIdentity((line) => new Set(effectiveTrackWords(line, "word")?.map((word) => word.id))),
  bg: memoByIdentity((line) => new Set(effectiveTrackWords(line, "bg")?.map((word) => word.id))),
};

// -- Functions ----------------------------------------------------------------

function hasAddresses(state: AddressedState): boolean {
  return (
    state.selectedWords.length > 0 ||
    state.stepQueue !== null ||
    state.editingWord !== null ||
    state.loupeTarget !== null ||
    state.contextMenu?.target.kind === "word"
  );
}

function lineIndexOf(lines: readonly LyricLine[], lineId: string): number | undefined {
  const hint = lineIndexHints.get(lineId);
  if (hint !== undefined && lines[hint]?.id === lineId) return hint;
  const index = resolveLineIndex(lines, lineId);
  if (index === undefined) lineIndexHints.delete(lineId);
  else lineIndexHints.set(lineId, index);
  return index;
}

// An address on a line object the change left alone is still live, so an edit costs only the lines it touched.
function liveCheck(lines: readonly LyricLine[], previous: readonly LyricLine[]) {
  return (address: SyllableAddress): boolean => {
    const index = lineIndexOf(lines, address.lineId);
    if (index === undefined) return false;
    const line = lines[index];
    if (previous[index] === line) return true;
    return trackWordIds[address.type](line).has(address.syllableId);
  };
}

// Words keep their ids when a drag reorders them, so the queue follows the new structural order.
function reorderedQueue(
  lines: readonly LyricLine[],
  previous: readonly LyricLine[],
  queue: SyllableAddress[],
): SyllableAddress[] {
  const untouched = queue.every((address) => {
    const index = lineIndexOf(lines, address.lineId);
    return index !== undefined && previous[index] === lines[index];
  });
  if (untouched || isInQueueOrder(lines, queue)) return queue;
  return queueOrder(lines, queue);
}

function liveList<A extends SyllableAddress>(addresses: A[], isLive: (address: A) => boolean): A[] {
  const firstGone = addresses.findIndex((address) => !isLive(address));
  if (firstGone === -1) return addresses;
  return [...addresses.slice(0, firstGone), ...addresses.slice(firstGone + 1).filter(isLive)];
}

// Only the fields that lost a word, or null when every addressed word is still there.
function liveTimelinePatch(
  lines: readonly LyricLine[],
  previous: readonly LyricLine[],
  state: AddressedState,
): AddressedPatch | null {
  if (!hasAddresses(state)) return null;
  const isLive = liveCheck(lines, previous);
  const patch: AddressedPatch = {};
  const selectedWords = liveList(state.selectedWords, isLive);
  if (selectedWords !== state.selectedWords) patch.selectedWords = selectedWords;
  const stepQueue = state.stepQueue && reorderedQueue(lines, previous, liveList(state.stepQueue, isLive));
  if (stepQueue !== state.stepQueue) patch.stepQueue = stepQueue?.length ? stepQueue : null;
  const cursorGone = state.selectedWords.length > 0 && selectedWords[0] !== state.selectedWords[0];
  if (cursorGone && stepQueue?.length)
    Object.assign(patch, selectionPatch({ ...state, selectedWords: [] }, stepQueue, true));
  if (state.editingWord && !isLive(state.editingWord)) patch.editingWord = null;
  if (state.loupeTarget && !isLive(state.loupeTarget)) patch.loupeTarget = null;
  const menuTarget = state.contextMenu?.target;
  if (menuTarget?.kind === "word" && !isLive(menuTarget)) patch.contextMenu = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

// Every lines change (commands, undo, redo, restores, previews) drops the addresses whose word is gone right after
// its write, before any row renders; addresses whose word survived keep naming it.
function followLyricLines(): () => void {
  return onLyricsChanged(({ before, after }) => {
    const patch = liveTimelinePatch(after, before, useTimelineStore.getState());
    if (patch) useTimelineStore.setState(patch);
  });
}

// -- Exports ------------------------------------------------------------------

export { followLyricLines };
