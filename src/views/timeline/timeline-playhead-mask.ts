import { type BlockBox, WORD_BLOCK_SELECTOR, type WordBlockBoxes, blockBox } from "@/views/timeline/word-block-boxes";

// -- Constants -----------------------------------------------------------------

const MASK_DIM_ALPHA = 0.5;
const MASK_ROOT_SELECTOR = "[data-timeline-mask-root]";

// -- Helpers -------------------------------------------------------------------

// dnd-kit renders the drag ghost's word blocks into a DragOverlay that does not portal,
// so the marked root wraps both it and the scroll container: the smallest root that still
// holds every word block the document-scoped query used to find.
function playheadMaskRoot(scrollContainer: Element): ParentNode {
  return scrollContainer.closest(MASK_ROOT_SELECTOR) ?? scrollContainer.ownerDocument;
}

function cornerYInset(distFromEdge: number, radius: number): number {
  if (distFromEdge >= radius || distFromEdge < 0) return 0;
  const d = radius - distFromEdge;
  return radius - Math.sqrt(radius * radius - d * d);
}

// Word blocks outside the scroll container (the drag ghost) are few and move with the pointer, so they are read every frame.
function boxesOutside(container: Element, originLeft: number, originTop: number): BlockBox[] {
  const boxes: BlockBox[] = [];
  const root = playheadMaskRoot(container);
  let node: Element = container;
  while (node !== root && node.parentNode) {
    const parent: ParentNode = node.parentNode;
    for (const sibling of parent.children) {
      if (sibling === node) continue;
      for (const block of sibling.querySelectorAll<HTMLElement>(WORD_BLOCK_SELECTOR)) {
        boxes.push(blockBox(block, originLeft, originTop));
      }
    }
    if (parent === root || !(parent instanceof Element)) break;
    node = parent;
  }
  return boxes;
}

function buildPlayheadMask(boxes: readonly BlockBox[], playheadX: number, containerTop: number): string {
  const ranges: { top: number; bottom: number }[] = [];
  for (const box of boxes) {
    if (playheadX < box.left || playheadX > box.right) continue;
    const corners = getComputedStyle(box.block);
    const leftR = Number.parseFloat(corners.borderTopLeftRadius) || 0;
    const rightR = Number.parseFloat(corners.borderTopRightRadius) || 0;
    const yInset = Math.max(cornerYInset(playheadX - box.left, leftR), cornerYInset(box.right - playheadX, rightR));
    ranges.push({ top: box.top - containerTop + yInset, bottom: box.bottom - containerTop - yInset });
  }

  if (ranges.length === 0) return "";
  ranges.sort((a, b) => a.top - b.top);
  const merged: { top: number; bottom: number }[] = [{ ...ranges[0] }];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].top <= last.bottom) {
      last.bottom = Math.max(last.bottom, ranges[i].bottom);
    } else {
      merged.push({ ...ranges[i] });
    }
  }
  const dim = `rgba(0,0,0,${MASK_DIM_ALPHA})`;
  const stops: string[] = ["black 0"];
  for (const r of merged) {
    stops.push(`black ${r.top}px`, `${dim} ${r.top}px`, `${dim} ${r.bottom}px`, `black ${r.bottom}px`);
  }
  stops.push("black 100%");
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

function playheadMask(
  wordBlocks: Pick<WordBlockBoxes, "boxes" | "originLeft" | "originTop">,
  container: HTMLElement,
  playheadX: number,
  overlayTop: number,
): string {
  const { boxes, originLeft, originTop } = wordBlocks;
  const outside = boxesOutside(container, originLeft, originTop);
  const allBoxes = outside.length === 0 ? boxes : [...boxes, ...outside];
  return buildPlayheadMask(allBoxes, playheadX - originLeft, overlayTop - originTop);
}

// -- Exports -------------------------------------------------------------------

export { buildPlayheadMask, playheadMask, playheadMaskRoot };
