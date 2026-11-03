import { useSyncExternalStore } from "react";
import { readUnisonSession, type StoredUnisonSession, subscribeUnisonSession } from "@/lib/unison/session";

// -- Hooks ---------------------------------------------------------------------

function readServerSnapshot(): StoredUnisonSession | null {
  return null;
}

function useUnisonSession(): StoredUnisonSession | null {
  return useSyncExternalStore(subscribeUnisonSession, readUnisonSession, readServerSnapshot);
}

// -- Exports -------------------------------------------------------------------

export { useUnisonSession };
