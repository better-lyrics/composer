// -- Functions -----------------------------------------------------------------

function holdsSnapBypass(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}

// -- Exports -------------------------------------------------------------------

export { holdsSnapBypass };
