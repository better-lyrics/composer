// -- State ---------------------------------------------------------------------

const holders = new Map<string, number>();

// -- Functions -----------------------------------------------------------------

function disableShortcut(id: string): () => void {
  holders.set(id, (holders.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (holders.get(id) ?? 1) - 1;
    if (count > 0) holders.set(id, count);
    else holders.delete(id);
  };
}

function isShortcutDisabled(id: string): boolean {
  return holders.has(id);
}

// -- Exports -------------------------------------------------------------------

export { disableShortcut, isShortcutDisabled };
