import { create } from "zustand";
import { persist } from "zustand/middleware";

// Whether this browser shares alignment telemetry, and the random id its
// payloads carry. The id names no person or account; it exists so everything
// this browser sent can be deleted with one request.

// -- Types --------------------------------------------------------------------

interface AlignmentTelemetryState {
  enabled: boolean;
  installId: string;
  /** Whether anything was sent under `installId`, so turning sharing off knows to ask the server to delete it. */
  sentUnderId: boolean;
  /** Ids whose server-side delete hasn't gone through yet; retried on the next start. */
  pendingDeletes: string[];
}

// -- Functions ----------------------------------------------------------------

function alignmentTelemetryInitialState(): AlignmentTelemetryState {
  return { enabled: true, installId: crypto.randomUUID(), sentUnderId: false, pendingDeletes: [] };
}

// -- Store --------------------------------------------------------------------

const useAlignmentTelemetryStore = create<AlignmentTelemetryState>()(
  persist(alignmentTelemetryInitialState, { name: "composer-alignment-telemetry" }),
);

// -- Exports ------------------------------------------------------------------

export { alignmentTelemetryInitialState, useAlignmentTelemetryStore };
