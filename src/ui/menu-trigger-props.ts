// -- Helpers ------------------------------------------------------------------

function menuTriggerProps(isOpen: boolean) {
  return { "aria-haspopup": "menu", "aria-expanded": isOpen } as const;
}

// -- Exports ------------------------------------------------------------------

export { menuTriggerProps };
