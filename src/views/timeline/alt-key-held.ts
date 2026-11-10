import { useSyncExternalStore } from "react";

// -- State ---------------------------------------------------------------------

let altHeld = false;
const listeners = new Set<() => void>();

// -- Helpers -------------------------------------------------------------------

function noteAltKey(event: KeyboardEvent): void {
  if (altHeld === event.altKey) return;
  altHeld = event.altKey;
  for (const listener of listeners) listener();
}

function subscribeAltHeld(listener: () => void): () => void {
  if (listeners.size === 0) {
    altHeld = false;
    document.addEventListener("keydown", noteAltKey);
    document.addEventListener("keyup", noteAltKey);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    document.removeEventListener("keydown", noteAltKey);
    document.removeEventListener("keyup", noteAltKey);
  };
}

const altHeldSnapshot = () => altHeld;
const altReleasedOnServer = () => false;

// -- Hook ----------------------------------------------------------------------

// One pair of document listeners for every subscriber, instead of one pair per word track.
function useAltHeld(): boolean {
  return useSyncExternalStore(subscribeAltHeld, altHeldSnapshot, altReleasedOnServer);
}

// -- Exports -------------------------------------------------------------------

export { useAltHeld };
