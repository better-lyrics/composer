// -- Constants ----------------------------------------------------------------

const FOCUSABLE_CONTROL = "button:not(:disabled), input:not(:disabled)";

// -- Helpers ------------------------------------------------------------------

// A view swap unmounts the focused control, so the new view takes focus unless one of its controls already did.
function focusIfFocusLost(view: HTMLElement | null, selector: string): void {
  if (!view || (document.activeElement !== null && document.activeElement !== document.body)) return;
  (view.querySelector<HTMLElement>(selector) ?? view.querySelector<HTMLElement>(FOCUSABLE_CONTROL))?.focus();
}

function focusFirstControlIfFocusLost(view: HTMLElement | null): void {
  focusIfFocusLost(view, FOCUSABLE_CONTROL);
}

// -- Exports ------------------------------------------------------------------

export { focusFirstControlIfFocusLost, focusIfFocusLost };
