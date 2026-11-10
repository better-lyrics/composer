// -- State ---------------------------------------------------------------------

const containers = new WeakMap<Element, HTMLElement>();

// -- Functions -----------------------------------------------------------------

// Frame callbacks ask every frame; an element never moves to another scroll container, so one lookup per element is enough.
function scrollContainerOf(element: Element | null | undefined): HTMLElement | null {
  if (!element) return null;
  const cached = containers.get(element);
  if (cached) return cached;
  const container = element.closest<HTMLElement>("[data-scroll-container]");
  if (container) containers.set(element, container);
  return container;
}

// -- Exports -------------------------------------------------------------------

export { scrollContainerOf };
