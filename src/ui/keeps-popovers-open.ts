// -- Constants ----------------------------------------------------------------

const KEEPS_POPOVERS_OPEN_PROPS = { "data-keeps-popovers-open": "" } as const;

// -- Helpers ------------------------------------------------------------------

function keepsPopoversOpen(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-keeps-popovers-open]") !== null;
}

// -- Exports ------------------------------------------------------------------

export { KEEPS_POPOVERS_OPEN_PROPS, keepsPopoversOpen };
