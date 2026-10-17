// -- Helpers ------------------------------------------------------------------

function focusAndSelectOnMount(el: HTMLInputElement | null): void {
  if (!el) return;
  el.focus();
  el.select();
}

// -- Exports ------------------------------------------------------------------

export { focusAndSelectOnMount };
