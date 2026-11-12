import { isPlaybackStyleWrite } from "@/views/timeline/playback-style-mutation";
import { LIGHT_ATTRIBUTES } from "@/views/timeline/timeline-lights";

// -- Types ---------------------------------------------------------------------

interface BlockBox {
  block: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Boxes are in scroll content coordinates: add the origin to get viewport coordinates.
interface WordBlockBoxes {
  container: HTMLElement | null;
  observer: MutationObserver | null;
  stale: boolean;
  blocks: HTMLElement[];
  boxes: BlockBox[];
  originLeft: number;
  originTop: number;
}

// -- Constants -----------------------------------------------------------------

const WORD_BLOCK_SELECTOR = "[data-word-block]";
const SENTINEL_TOLERANCE_PX = 0.5;

// -- Functions -----------------------------------------------------------------

function createWordBlockBoxes(): WordBlockBoxes {
  return { container: null, observer: null, stale: true, blocks: [], boxes: [], originLeft: 0, originTop: 0 };
}

// A block is absolutely placed with its own size, so nothing inside it can move it.
function movesWordBlocks(mutation: MutationRecord): boolean {
  const { target } = mutation;
  if (mutation.type !== "attributes") return !(target instanceof Element && target.closest(WORD_BLOCK_SELECTOR));
  if (LIGHT_ATTRIBUTES.has(mutation.attributeName ?? "") || isPlaybackStyleWrite(mutation)) return false;
  return !target.parentElement?.closest(WORD_BLOCK_SELECTOR);
}

function noteMutations(state: WordBlockBoxes, mutations: readonly MutationRecord[]): void {
  if (!state.stale && mutations.some(movesWordBlocks)) state.stale = true;
}

function observeContainer(state: WordBlockBoxes, container: HTMLElement): MutationObserver {
  const observer = state.observer ?? new MutationObserver((mutations) => noteMutations(state, mutations));
  observer.disconnect();
  observer.observe(container, { subtree: true, childList: true, attributes: true, attributeOldValue: true });
  state.observer = observer;
  state.container = container;
  state.stale = true;
  return observer;
}

function blockBox(block: HTMLElement, originLeft: number, originTop: number): BlockBox {
  const rect = block.getBoundingClientRect();
  return {
    block,
    left: rect.left - originLeft,
    right: rect.right - originLeft,
    top: rect.top - originTop,
    bottom: rect.bottom - originTop,
  };
}

// Layout above the rows (the band's min-height transition) moves every block without a mutation in the container.
function sentinelMoved(state: WordBlockBoxes): boolean {
  const cached = state.boxes[0];
  if (!cached.block.isConnected) return true;
  const rect = cached.block.getBoundingClientRect();
  return (
    Math.abs(rect.left - state.originLeft - cached.left) > SENTINEL_TOLERANCE_PX ||
    Math.abs(rect.top - state.originTop - cached.top) > SENTINEL_TOLERANCE_PX
  );
}

function measureBlocks(state: WordBlockBoxes, container: HTMLElement): void {
  state.blocks.length = 0;
  state.boxes.length = 0;
  for (const block of container.querySelectorAll<HTMLElement>(WORD_BLOCK_SELECTOR)) {
    state.blocks.push(block);
    state.boxes.push(blockBox(block, state.originLeft, state.originTop));
  }
}

// Scrolling only moves the origin, so the blocks are queried and read again only after the DOM under the container changes.
function refreshWordBlockBoxes(
  state: WordBlockBoxes,
  container: HTMLElement,
  scroll: { readonly left: number; readonly top: number },
): void {
  const observer =
    state.container === container && state.observer ? state.observer : observeContainer(state, container);
  noteMutations(state, observer.takeRecords());
  const rect = container.getBoundingClientRect();
  state.originLeft = rect.left - scroll.left;
  state.originTop = rect.top - scroll.top;
  if (!state.stale && state.boxes.length > 0 && sentinelMoved(state)) state.stale = true;
  if (!state.stale) return;
  measureBlocks(state, container);
  // A hidden container lays every block out at zero, so measure again once it shows.
  state.stale = rect.width === 0 && rect.height === 0;
}

function releaseWordBlockBoxes(state: WordBlockBoxes): void {
  state.observer?.disconnect();
  state.container = null;
  state.stale = true;
  state.blocks.length = 0;
  state.boxes.length = 0;
}

// -- Exports -------------------------------------------------------------------

export type { BlockBox, WordBlockBoxes };
export { WORD_BLOCK_SELECTOR, blockBox, createWordBlockBoxes, refreshWordBlockBoxes, releaseWordBlockBoxes };
