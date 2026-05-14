import { userEvent } from "vitest/browser";

const DND_KIT_ACTIVATION_DISTANCE = 8;

interface Point {
  x: number;
  y: number;
}

interface DragLocator {
  element: () => Element;
}

interface DropLocator {
  element: () => Element;
}

async function dragLocator(from: DragLocator, to: DropLocator | Point): Promise<void> {
  if ("element" in to) {
    await userEvent.dragAndDrop(from.element() as HTMLElement, to.element() as HTMLElement);
    return;
  }

  const sourceEl = from.element() as HTMLElement;
  const rect = sourceEl.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  sourceEl.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: startX, clientY: startY }));
  sourceEl.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: startX + DND_KIT_ACTIVATION_DISTANCE + 1,
      clientY: startY,
    }),
  );
  sourceEl.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: to.x, clientY: to.y }));
  sourceEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: to.x, clientY: to.y }));
}

export { dragLocator, DND_KIT_ACTIVATION_DISTANCE };
export type { Point };
