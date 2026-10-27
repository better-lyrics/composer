// -- Types ---------------------------------------------------------------------

interface PointerPosition {
  clientX: number;
  clientY: number;
}

// -- State ---------------------------------------------------------------------

let lastPointer: PointerPosition | null = null;

// -- Functions -----------------------------------------------------------------

function rememberPointer(e: PointerPosition): void {
  lastPointer = { clientX: e.clientX, clientY: e.clientY };
}

function lastKnownPointer(): PointerPosition | null {
  return lastPointer;
}

// -- Exports -------------------------------------------------------------------

export { lastKnownPointer, rememberPointer };
