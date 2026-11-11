// -- Constants ----------------------------------------------------------------

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
    () => {
      lastInputWasPointer = true;
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

// A control in a popover, or one tabbed to, gets its own Enter and Space. A button left focused by a click does not, so Enter still plays after one.
function focusedControlOwnsKey(event: KeyboardEvent): boolean {
  if (!ACTIVATION_KEYS.has(event.key)) return false;
  const { target } = event;
  if (!(target instanceof HTMLElement) || !target.matches(ACTIVATABLE_CONTROL)) return false;
  if (target.closest(FLOATING_LAYER) !== null) return true;
  return !focusedByPointer && target.tabIndex >= 0;
}

// -- Exports ------------------------------------------------------------------

export { focusedControlOwnsKey };
