import { useSyncExternalStore } from "react";

// -- Types ---------------------------------------------------------------------

interface HistoryRequest {
  lyricId: number;
  revNo: number;
}

// -- State ---------------------------------------------------------------------

// Session only: a request from the library survives the route change to the editor, never a reload.
let pendingRequest: HistoryRequest | null = null;
const listeners = new Set<() => void>();

function publish(request: HistoryRequest | null): void {
  pendingRequest = request;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): HistoryRequest | null {
  return pendingRequest;
}

// -- Functions -----------------------------------------------------------------

function requestHistoryAt(lyricId: number, revNo: number): void {
  publish({ lyricId, revNo });
}

function clearHistoryRequest(): void {
  if (pendingRequest) publish(null);
}

// -- Hook ----------------------------------------------------------------------

function useHistoryRequest(lyricId: number): number | null {
  const request = useSyncExternalStore(subscribe, snapshot, snapshot);
  return request?.lyricId === lyricId ? request.revNo : null;
}

// -- Exports -------------------------------------------------------------------

export { clearHistoryRequest, requestHistoryAt, useHistoryRequest };
