import { getShortcutById } from "@/stores/shortcut-registry";

// -- Constants ----------------------------------------------------------------

const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "range",
  "color",
  "image",
]);

const ACTIVATION_KEYS = new Set(["Enter", " "]);
const ACTIVATABLE_CONTROL =
  "button, a[href], summary, [role='button'], [role='option'], [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='tab'], [role='switch']";
const FLOATING_LAYER = "[data-floating-ui-portal]";

// -- State --------------------------------------------------------------------

let lastInputWasPointer = false;
let focusedByPointer = false;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (event) => {
      lastInputWasPointer = true;
      if (event.target instanceof Node && document.activeElement?.contains(event.target)) focusedByPointer = true;
    },
    true,
  );
  window.addEventListener(
    "keydown",
    () => {
      lastInputWasPointer = false;
    },
    true,
  );
  window.addEventListener(
    "focusin",
    () => {
      focusedByPointer = lastInputWasPointer;
    },
    true,
  );
}

// -- API ----------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function hasNativeTextUndo(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}

// A control in a popover, or one tabbed to, gets its own Enter and Space. A button left focused by a click does not, so Enter still plays after one.
function focusedControlOwnsKey(event: KeyboardEvent): boolean {
  if (!ACTIVATION_KEYS.has(event.key) || event.defaultPrevented) return false;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
  const { target } = event;
  if (!(target instanceof HTMLElement) || !target.matches(ACTIVATABLE_CONTROL)) return false;
  if (isInPopover(target)) return true;
  return !focusedByPointer && target.tabIndex >= 0;
}

function isInPopover(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(FLOATING_LAYER) !== null;
}

// A field in a popover keeps every key except the shortcuts made to work while typing, such as play.
function popoverFieldOwnsShortcut(event: KeyboardEvent, id: string): boolean {
  return isTypingTarget(event.target) && isInPopover(event.target) && !getShortcutById(id)?.needsCommandKey;
}

// -- Exports ------------------------------------------------------------------

export { focusedControlOwnsKey, hasNativeTextUndo, isInPopover, isTypingTarget, popoverFieldOwnsShortcut };
