import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- State ---------------------------------------------------------------------

const view = { left: 0, top: 0 };

// -- Functions -----------------------------------------------------------------

function viewScrollLeft(): number {
  return view.left;
}

function viewScrollTop(): number {
  return view.top;
}

// Input runs before the frame's scroll event, so handlers read the scroller itself to see a scroll the compositor already shows.
function readViewScroll(container: HTMLElement): Readonly<typeof view> {
  view.left = container.scrollLeft;
  view.top = container.scrollTop;
  return view;
}

// Scroll events run before frame callbacks, so frame callbacks read the cached position.
function syncViewScroll(container: HTMLElement): void {
  readViewScroll(container);
  const { setScrollLeft, setScrollTop } = useTimelineStore.getState();
  setScrollLeft(view.left);
  setScrollTop(view.top);
}

// A scroll write lays out to clamp, so reading the clamped value back is free.
function scrollView(container: HTMLElement, left: number | null, top: number | null = null): void {
  if (left !== null) {
    container.scrollLeft = left;
    view.left = container.scrollLeft;
  }
  if (top !== null) {
    container.scrollTop = top;
    view.top = container.scrollTop;
  }
}

function scrollViewBy(container: HTMLElement, deltaLeft: number, deltaTop: number): void {
  const { left, top } = readViewScroll(container);
  scrollView(container, deltaLeft === 0 ? null : left + deltaLeft, deltaTop === 0 ? null : top + deltaTop);
}

// The animation's scroll events keep the cached position current.
function smoothScrollView(container: HTMLElement, left: number | undefined, top?: number): void {
  container.scrollTo({ left, top, behavior: "smooth" });
}

// -- Exports -------------------------------------------------------------------

export { readViewScroll, scrollView, scrollViewBy, smoothScrollView, syncViewScroll, viewScrollLeft, viewScrollTop };
