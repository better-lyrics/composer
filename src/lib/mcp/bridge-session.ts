import { MCP_TOOL_DEFINITIONS } from "@/domain/mcp/tool-definitions";
import { setMcpBridgeStatus } from "@/lib/mcp/bridge-status";
import { runMcpTool } from "@/lib/mcp/run-tool";
import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { stripTrailingSlashes } from "@/utils/url";

// -- Types --------------------------------------------------------------------

interface BridgeSessionKeys {
  sessionId: string;
  token: string;
}

interface BridgeToolCall {
  callId: string;
  name: string;
  arguments?: unknown;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[McpBridge]";
const STATE_DEBOUNCE_MS = 250;
// EventSource retries a dropped connection by itself, but gives up for good
// when the bridge answers with an error (an older bridge has no agent endpoint).
const REFUSED_RETRY_MS = 15_000;

// -- Helpers ------------------------------------------------------------------

function parseEvent<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (error) {
    console.error(LOG_PREFIX, `unreadable ${event.type} event`, error);
    return null;
  }
}

function projectState(): unknown {
  const projectId = openProjectIdSnapshot();
  if (!projectId) return null;
  const { metadata, lines } = useProjectStore.getState();
  return {
    projectId,
    title: metadata.title,
    artists: metadata.artists,
    language: metadata.language || null,
    lineCount: lines.length,
  };
}

function tabIsFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

// -- Session ------------------------------------------------------------------

/**
 * Keeps this tab registered with Composer Bridge so MCP clients can reach the
 * open project. The bridge only relays: every tool runs here, through the same
 * store writes the UI uses. Returns a function that disconnects.
 */
function startMcpBridgeSession(bridgeUrl: string): () => void {
  const base = stripTrailingSlashes(bridgeUrl);
  let source: EventSource | null = null;
  let keys: BridgeSessionKeys | null = null;
  let stateTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const post = (path: string, body: Record<string, unknown>) => {
    if (!keys) return;
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...keys, ...body }),
    }).catch((error: unknown) => console.warn(LOG_PREFIX, `POST ${path} failed`, error));
  };

  const sendState = () => {
    clearTimeout(stateTimer);
    post("/agent/state", { tools: MCP_TOOL_DEFINITIONS, project: projectState(), focused: tabIsFocused() });
  };

  const scheduleState = () => {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(sendState, STATE_DEBOUNCE_MS);
  };

  const connect = () => {
    setMcpBridgeStatus("connecting");
    const next = new EventSource(`${base}/agent/connect`);
    source = next;
    next.addEventListener("ready", (event) => {
      keys = parseEvent<BridgeSessionKeys>(event);
      if (!keys) return;
      setMcpBridgeStatus("connected");
      sendState();
    });
    next.addEventListener("call", (event) => {
      const call = parseEvent<BridgeToolCall>(event);
      if (!call) return;
      post("/agent/result", { callId: call.callId, result: runMcpTool(call.name, call.arguments) });
    });
    next.addEventListener("error", () => {
      keys = null;
      if (next.readyState !== EventSource.CLOSED) {
        setMcpBridgeStatus("connecting");
        return;
      }
      setMcpBridgeStatus("outdated");
      if (!stopped) retryTimer = setTimeout(connect, REFUSED_RETRY_MS);
    });
  };

  const unsubscribeStore = useProjectStore.subscribe((state, previous) => {
    if (
      state.metadata !== previous.metadata ||
      state.lines.length !== previous.lines.length ||
      state.projectSession !== previous.projectSession
    ) {
      scheduleState();
    }
  });
  const unsubscribeProjectId = subscribeOpenProjectId(scheduleState);
  window.addEventListener("focus", sendState);
  document.addEventListener("visibilitychange", sendState);
  connect();

  return () => {
    stopped = true;
    clearTimeout(stateTimer);
    clearTimeout(retryTimer);
    source?.close();
    unsubscribeStore();
    unsubscribeProjectId();
    window.removeEventListener("focus", sendState);
    document.removeEventListener("visibilitychange", sendState);
    setMcpBridgeStatus("off");
  };
}

// -- Exports ------------------------------------------------------------------

export { startMcpBridgeSession };
