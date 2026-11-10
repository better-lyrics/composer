import { highlightedBlocks } from "@/ui/lyrics-code/code-blocks";
import { useCallback, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const INITIAL_HIGHLIGHTED_BLOCKS: readonly number[] = [0, 1];
// A block is highlighted within one viewport of the scroll pane, so it is ready before it scrolls in.
const NEAR_MARGIN = "100% 0px";
// It stays highlighted until it is three viewports away, so scrolling back and forth does not rebuild it.
const RELEASE_MARGIN = "300% 0px";
const MAX_HIGHLIGHTED_BLOCKS = 12;

// -- Functions ----------------------------------------------------------------

function blockIndex(element: Element): number {
  return element instanceof HTMLElement ? Number(element.dataset.codeBlock) : Number.NaN;
}

function holdsSelection(element: Element | undefined): boolean {
  return element?.ownerDocument.getSelection()?.containsNode(element, true) ?? false;
}

function sameBlocks(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((index, position) => b[position] === index);
}

// Safari has no scrollMargin and falls back to the root margin alone.
function zoneOptions(margin: string): IntersectionObserverInit & { scrollMargin: string } {
  return { rootMargin: margin, scrollMargin: margin };
}

function observeZone(margin: string, zone: Set<number>, onChange: () => void): IntersectionObserver {
  return new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.boundingClientRect;
      // A hidden pane reports every block as far away; keep what was near for when it shows again.
      if (width === 0 && height === 0) continue;
      const index = blockIndex(entry.target);
      if (entry.isIntersecting) zone.add(index);
      else zone.delete(index);
    }
    onChange();
  }, zoneOptions(margin));
}

// -- Hooks --------------------------------------------------------------------

function useBlocksNearView() {
  const [highlighted, setHighlighted] = useState(INITIAL_HIGHLIGHTED_BLOCKS);
  const observersRef = useRef<IntersectionObserver[] | null>(null);
  const zonesRef = useRef({ near: new Set<number>(), kept: new Set<number>() });
  const elementsRef = useRef(new Map<number, HTMLElement>());

  const observeBlock = useCallback((block: HTMLElement) => {
    const { near, kept } = zonesRef.current;
    const elements = elementsRef.current;
    const update = () =>
      setHighlighted((previous) => {
        const next = highlightedBlocks({
          previous,
          near,
          kept,
          cap: MAX_HIGHLIGHTED_BLOCKS,
          holdsSelection: (index) => holdsSelection(elements.get(index)),
        });
        return sameBlocks(previous, next) ? previous : next;
      });
    observersRef.current ??= [observeZone(NEAR_MARGIN, near, update), observeZone(RELEASE_MARGIN, kept, update)];
    const observers = observersRef.current;
    const index = blockIndex(block);
    elements.set(index, block);
    // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- unobserved in this ref callback's cleanup
    for (const observer of observers) observer.observe(block);
    return () => {
      for (const observer of observers) observer.unobserve(block);
      if (elements.get(index) !== block) return;
      elements.delete(index);
      near.delete(index);
      kept.delete(index);
    };
  }, []);

  return { highlighted, observeBlock };
}

// -- Exports ------------------------------------------------------------------

export { useBlocksNearView };
