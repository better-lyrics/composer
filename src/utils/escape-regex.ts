// -- Escape --------------------------------------------------------------------

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -- Exports -------------------------------------------------------------------

export { escapeRegex };
