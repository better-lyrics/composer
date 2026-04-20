import { type Agent, type LyricLine, type ProjectMetadata, useProjectStore } from "@/stores/project";
import { useEffect } from "react";
import { toast } from "sonner";

const IMPORT_HASH_PREFIX = "#import=";

interface ImportPayload {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: "line" | "word";
}

function isValidPayload(value: unknown): value is ImportPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.metadata === "object" &&
    Array.isArray(payload.agents) &&
    Array.isArray(payload.lines) &&
    (payload.granularity === "line" || payload.granularity === "word")
  );
}

function useImportFromHash(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hash } = window.location;
    if (!hash.startsWith(IMPORT_HASH_PREFIX)) return;

    try {
      const encoded = hash.slice(IMPORT_HASH_PREFIX.length);
      const decoded = decodeURIComponent(encoded);
      const payload: unknown = JSON.parse(decoded);
      if (!isValidPayload(payload)) {
        console.error("[Composer] Invalid import payload structure");
        toast.error("Could not import converter result");
        return;
      }

      const state = useProjectStore.getState();
      state.reset();
      state.setMetadata(payload.metadata);
      state.setLines(payload.lines);
      state.setGranularity(payload.granularity);
      for (const agent of payload.agents) {
        if (!state.agents.some((existing) => existing.id === agent.id)) {
          state.addAgent(agent);
        } else {
          state.updateAgent(agent.id, agent);
        }
      }

      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      toast.success("Imported from converter");
    } catch (importError) {
      console.error("[Composer] Failed to import from hash", importError);
      toast.error("Could not import converter result");
    }
  }, []);
}

export { IMPORT_HASH_PREFIX, useImportFromHash };
