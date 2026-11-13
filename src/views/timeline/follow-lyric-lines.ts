import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveLineIndex } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type TimelineState = ReturnType<typeof useTimelineStore.getState>;
type AddressedState = Pick<
  TimelineState,
  "selectedWords" | "stepQueue" | "editingWord" | "loupeTarget" | "contextMenu"
>;

// -- State --------------------------------------------------------------------

// Where each addressed line was last found, so an edit that moves no line never indexes every line.
const lineIndexHints = new Map<string, number>();

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
    return effectiveTrackWords(line, address.type)?.some((word) => word.id === address.syllableId) ?? false;
  };
}

function liveList<A extends SyllableAddress>(addresses: A[], isLive: (address: A) => boolean): A[] {
  const live = addresses.filter(isLive);
  return live.length === addresses.length ? addresses : live;
}

// Only the fields that lost a word, or null when every addressed word is still there.
function liveTimelinePatch(
  lines: readonly LyricLine[],
  previous: readonly LyricLine[],
  state: AddressedState,
): Partial<AddressedState> | null {
  if (!hasAddresses(state)) return null;
  const isLive = liveCheck(lines, previous);
  const patch: Partial<AddressedState> = {};
  const selectedWords = liveList(state.selectedWords, isLive);
  if (selectedWords !== state.selectedWords) patch.selectedWords = selectedWords;
  const stepQueue = state.stepQueue && liveList(state.stepQueue, isLive);
  if (stepQueue !== state.stepQueue) patch.stepQueue = stepQueue?.length ? stepQueue : null;
  if (state.editingWord && !isLive(state.editingWord)) patch.editingWord = null;
  if (state.loupeTarget && !isLive(state.loupeTarget)) patch.loupeTarget = null;
  const menuTarget = state.contextMenu?.target;
  if (menuTarget?.kind === "word" && !isLive(menuTarget)) patch.contextMenu = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

// Every lines change (edits, undo, redo, restore) drops the addresses whose word is gone in the same synchronous
// set, before any row renders; addresses whose word survived keep naming it.
function followLyricLines(): () => void {
  return useProjectStore.subscribe((state, previous) => {
    if (state.lines === previous.lines) return;
    const patch = liveTimelinePatch(state.lines, previous.lines, useTimelineStore.getState());
    if (patch) useTimelineStore.setState(patch);
  });
}

// -- Exports ------------------------------------------------------------------

export { followLyricLines };
