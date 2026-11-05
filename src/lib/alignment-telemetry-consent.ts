import { clearAllTelemetry } from "@/lib/alignment-telemetry-storage";
import { useAlignmentTelemetryStore } from "@/stores/alignment-telemetry";
import { stripTrailingSlashes } from "@/utils/url";

// Turning alignment sharing on and off. Off deletes what this browser collected
// for every project at once, and asks the server to delete everything sent
// under this browser's install id; a delete that fails is retried on the next start.

// -- Constants ----------------------------------------------------------------

const DEFAULT_TELEMETRY_URL = "https://composer-alignment-telemetry.dacubeking.workers.dev";
const TELEMETRY_PATH = "/v1/telemetry";
const LOG_PREFIX = "[alignment-telemetry]";

// -- Functions ----------------------------------------------------------------

/** The collection endpoint, or null when telemetry has nowhere to go (tests, or a deployment that unsets it). */
function telemetryEndpoint(): string | null {
  const configured = import.meta.env.VITE_ALIGNMENT_TELEMETRY_URL;
  const base = configured ?? (import.meta.env.MODE === "test" ? "" : DEFAULT_TELEMETRY_URL);
  return base ? `${stripTrailingSlashes(base)}${TELEMETRY_PATH}` : null;
}

async function deleteSent(installId: string, endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/${installId}`, { method: "DELETE" });
    // A 400 means the server can't read the id; retrying won't change that.
    return response.ok || response.status === 400;
  } catch (error) {
    console.warn(LOG_PREFIX, "couldn't delete sent telemetry; retrying on the next start", error);
    return false;
  }
}

/** Retries the server-side deletes that haven't gone through. */
async function flushPendingDeletes(): Promise<void> {
  const endpoint = telemetryEndpoint();
  const pending = useAlignmentTelemetryStore.getState().pendingDeletes;
  if (!endpoint || pending.length === 0) return;
  const done = new Set<string>();
  for (const id of pending) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- a handful of ids at most, sent one by one
    if (await deleteSent(id, endpoint)) done.add(id);
  }
  useAlignmentTelemetryStore.setState((s) => ({ pendingDeletes: s.pendingDeletes.filter((id) => !done.has(id)) }));
}

async function setAlignmentSharing(enabled: boolean): Promise<void> {
  const state = useAlignmentTelemetryStore.getState();
  if (enabled) {
    useAlignmentTelemetryStore.setState({ enabled: true });
    return;
  }
  // A fresh id afterwards, so anything sent after turning it back on isn't tied to what was deleted.
  useAlignmentTelemetryStore.setState({
    enabled: false,
    installId: crypto.randomUUID(),
    sentUnderId: false,
    pendingDeletes: state.sentUnderId ? [...state.pendingDeletes, state.installId] : state.pendingDeletes,
  });
  await settleAlignmentSharing();
}

/** On start, and after a write that raced a switch to off: an off switch leaves nothing behind. */
async function settleAlignmentSharing(): Promise<void> {
  if (!useAlignmentTelemetryStore.getState().enabled) {
    try {
      await clearAllTelemetry();
    } catch (error) {
      console.warn(LOG_PREFIX, "couldn't clear collected telemetry", error);
    }
  }
  await flushPendingDeletes();
}

// -- Exports ------------------------------------------------------------------

export { setAlignmentSharing, settleAlignmentSharing, telemetryEndpoint };
