// -- Types --------------------------------------------------------------------

/** connected: the bridge has this tab; outdated: a bridge answered but has no agent endpoint. */
type McpBridgeStatus = "off" | "connecting" | "connected" | "outdated";

// -- Module state -------------------------------------------------------------

let status: McpBridgeStatus = "off";
const listeners = new Set<() => void>();

// -- Functions ----------------------------------------------------------------

function setMcpBridgeStatus(next: McpBridgeStatus): void {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

function mcpBridgeStatusSnapshot(): McpBridgeStatus {
  return status;
}

function subscribeMcpBridgeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -- Exports ------------------------------------------------------------------

export { mcpBridgeStatusSnapshot, setMcpBridgeStatus, subscribeMcpBridgeStatus };
export type { McpBridgeStatus };
