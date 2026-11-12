import { alsoMovesLabel, copiesMovedWith } from "@/domain/group/moved-copies";
import type { WordSelection } from "@/domain/selection/model";
import { subscribeFrame, wake } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { wordBlockId } from "@/views/timeline/word-block-id";

// -- Types --------------------------------------------------------------------

type DraggedWord = Pick<WordSelection, "lineId" | "wordIndex" | "type">;

// -- Constants ----------------------------------------------------------------

const CHIP_OFFSET_X = 14;
const CHIP_OFFSET_Y = 22;
const CHIP_FRAME_LABEL = "shared-copies-chip";
const noop = () => {};

// -- State --------------------------------------------------------------------

// One hint for the whole Timeline: only one word drag runs at a time.
let label: string | null = null;
const listeners = new Set<() => void>();
let chip: HTMLElement | null = null;
let pointerX = 0;
let pointerY = 0;
let placedX = Number.NaN;
let placedY = Number.NaN;
let stopActive: (() => void) | null = null;

// -- Helpers ------------------------------------------------------------------

function setLabel(next: string | null): void {
  if (next === label) return;
  label = next;
  for (const listener of listeners) listener();
}

function placeChip(): void {
  if (!chip || (pointerX === placedX && pointerY === placedY)) return;
  placedX = pointerX;
  placedY = pointerY;
  chip.style.transform = `translate3d(${pointerX + CHIP_OFFSET_X}px, ${pointerY + CHIP_OFFSET_Y}px, 0)`;
}

function markCopyBlocks(words: readonly DraggedWord[], lineIdsBySource: ReadonlyMap<string, string[]>): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (const word of words) {
    for (const copyLineId of lineIdsBySource.get(word.lineId) ?? []) {
      const block = document.getElementById(wordBlockId(copyLineId, word.type, word.wordIndex));
      if (!block) continue;
      block.dataset.movesWithDrag = "";
      marked.push(block);
    }
  }
  return marked;
}

const subscribeSharedCopiesHint = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const sharedCopiesHintSnapshot = () => label;

function attachSharedCopiesChip(element: HTMLElement | null): void {
  chip = element;
  placedX = Number.NaN;
  placedY = Number.NaN;
  placeChip();
}

// -- API ----------------------------------------------------------------------

// Targets are read once here; the drag's frames only move the chip. Returns an idempotent stop.
function startSharedCopiesHint(words: readonly DraggedWord[], clientX: number, clientY: number): () => void {
  stopActive?.();
  const { lines, groups } = useProjectStore.getState();
  const copies = copiesMovedWith(
    lines,
    groups,
    words.map((word) => word.lineId),
  );
  const nextLabel = alsoMovesLabel(copies.names);
  if (nextLabel === null) return noop;

  const marked = markCopyBlocks(words, copies.lineIdsBySource);
  pointerX = clientX;
  pointerY = clientY;
  const onPointerMove = (e: PointerEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    wake();
  };
  const unsubscribeFrame = subscribeFrame(placeChip, CHIP_FRAME_LABEL);

  const stop = () => {
    if (stopActive !== stop) return;
    stopActive = null;
    unsubscribeFrame();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stop, true);
    window.removeEventListener("pointercancel", stop, true);
    for (const block of marked) delete block.dataset.movesWithDrag;
    setLabel(null);
  };
  stopActive = stop;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", stop, true);
  window.addEventListener("pointercancel", stop, true);
  setLabel(nextLabel);
  return stop;
}

// -- Exports ------------------------------------------------------------------

export { attachSharedCopiesChip, sharedCopiesHintSnapshot, startSharedCopiesHint, subscribeSharedCopiesHint };
