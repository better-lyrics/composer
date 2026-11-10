import { useCallback, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const INITIAL_NEAR_BLOCKS: ReadonlySet<number> = new Set([0, 1]);
// One viewport above and below the scroll pane, so a block is highlighted before it scrolls in.
const NEAR_OPTIONS: IntersectionObserverInit & { scrollMargin: string } = {
  rootMargin: "100% 0px",
  scrollMargin: "100% 0px",
};

// -- Functions ----------------------------------------------------------------

function blockIndex(element: Element): number {
  return element instanceof HTMLElement ? Number(element.dataset.codeBlock) : Number.NaN;
}

function holdsSelection(element: Element): boolean {
  return element.ownerDocument.getSelection()?.containsNode(element, true) ?? false;
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every((index) => b.has(index));
}

// -- Hooks --------------------------------------------------------------------

function useBlocksNearView() {
  const [nearBlocks, setNearBlocks] = useState(INITIAL_NEAR_BLOCKS);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nearRef = useRef(new Set<number>());

  const observeBlock = useCallback((block: HTMLElement) => {
    observerRef.current ??= new IntersectionObserver((entries) => {
      const near = nearRef.current;
      for (const entry of entries) {
        const { width, height } = entry.boundingClientRect;
        // A hidden pane reports every block as far away; keep what was near for when it shows again.
        if (width === 0 && height === 0) continue;
        const index = blockIndex(entry.target);
        if (entry.isIntersecting || holdsSelection(entry.target)) near.add(index);
        else near.delete(index);
      }
      setNearBlocks((previous) => (sameSet(previous, near) ? previous : new Set(near)));
    }, NEAR_OPTIONS);
    const observer = observerRef.current;
    observer.observe(block);
    return () => {
      observer.unobserve(block);
      nearRef.current.delete(blockIndex(block));
    };
  }, []);

  return { nearBlocks, observeBlock };
}

// -- Exports ------------------------------------------------------------------

export { useBlocksNearView };
