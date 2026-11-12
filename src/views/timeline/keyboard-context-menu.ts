import type { MenuAnchor } from "@/ui/menu";

// -- Types ---------------------------------------------------------------------

interface ContextMenuPoint {
  x: number;
  y: number;
}

interface AnchoredContextMenu extends ContextMenuPoint {
  anchorElement?: Element;
}

// -- Functions -----------------------------------------------------------------

// Chromium and Firefox send button 0 for the ContextMenu key and Shift+F10, and 2 for a right click.
// A Mac Control-click also sends 0, so it is told apart by ctrlKey; a touch long press by its pointerType.
function isKeyboardContextMenu(event: MouseEvent): boolean {
  const fromTouchOrPen =
    event instanceof PointerEvent && (event.pointerType === "touch" || event.pointerType === "pen");
  return event.button === 0 && !event.ctrlKey && !fromTouchOrPen;
}

function contextMenuPoint(event: React.MouseEvent): ContextMenuPoint {
  if (!isKeyboardContextMenu(event.nativeEvent)) return { x: event.clientX, y: event.clientY };
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
}

function contextMenuAnchor({ x, y, anchorElement }: AnchoredContextMenu): MenuAnchor {
  return anchorElement ? { kind: "element", element: anchorElement } : { kind: "point", x, y, within: document.body };
}

// -- Exports -------------------------------------------------------------------

export { contextMenuAnchor, contextMenuPoint, isKeyboardContextMenu };
