import { useSyncExternalStore } from "react";

// -- Helpers ------------------------------------------------------------------

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

function hiddenOnServer(): boolean {
  return false;
}

// -- Hook ---------------------------------------------------------------------

function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, isPageVisible, hiddenOnServer);
}

// -- Exports ------------------------------------------------------------------

export { usePageVisible };
