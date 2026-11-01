import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { startSongInNewProject } from "@/lib/open-project";
import { getPersistenceSettled, markHashImportSettled } from "@/lib/persistence-settled";
import { useProjectStore } from "@/stores/project";
import { IMPORT_HASH_PREFIX } from "@/utils/incoming-link";
import { showNewProjectToast } from "@/utils/project-toast";
import { useEffect } from "react";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface ImportPayload {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: "line" | "word";
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Helpers ------------------------------------------------------------------

function isValidPayload(value: unknown): value is ImportPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.metadata !== null &&
    typeof payload.metadata === "object" &&
    Array.isArray(payload.agents) &&
    Array.isArray(payload.lines) &&
    (payload.granularity === "line" || payload.granularity === "word")
  );
}

function applyImport(payload: ImportPayload, metadata: ProjectMetadata): void {
  useProjectStore.getState().reset();
  const state = useProjectStore.getState();
  state.setMetadata(metadata);
  state.setLines(payload.lines);
  state.setGranularity(payload.granularity);
  for (const agent of payload.agents) {
    if (!useProjectStore.getState().agents.some((existing) => existing.id === agent.id)) {
      state.addAgent(agent);
    } else {
      state.updateAgent(agent.id, agent);
    }
  }
  state.markSongDetailsImported();
}

function clearImportHash(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

async function importInNewProject(payload: ImportPayload, metadata: ProjectMetadata): Promise<boolean> {
  const started = await startSongInNewProject(metadata.title, (song) => {
    applyImport(payload, metadata);
    return song;
  });
  if (!started) return false;
  showNewProjectToast(metadata.title, started.previousTitle, started.previousId, started.newId);
  return true;
}

// -- Hook ---------------------------------------------------------------------

function useImportFromHash(): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      markHashImportSettled();
      return;
    }
    const { hash } = window.location;
    if (!hash.startsWith(IMPORT_HASH_PREFIX)) {
      markHashImportSettled();
      return;
    }

    const runImport = async () => {
      try {
        const encoded = hash.slice(IMPORT_HASH_PREFIX.length);
        const decoded = decodeURIComponent(encoded);
        const payload: unknown = JSON.parse(decoded);
        if (!isValidPayload(payload)) {
          console.error(LOG_PREFIX, "Invalid import payload structure");
          toast.error("Could not import converter result");
          return;
        }

        if (import.meta.env.DEV) console.log("[Boot] useImportFromHash awaiting settled");
        await getPersistenceSettled();
        if (import.meta.env.DEV) console.log("[Boot] useImportFromHash settled");

        const metadata = normalizeLoadedMetadata(payload.metadata);
        const openedNew =
          hasLyricLines(useProjectStore.getState().lines) && (await importInNewProject(payload, metadata));
        if (!openedNew) {
          applyImport(payload, metadata);
          toast.success("Imported from converter");
        }
        clearImportHash();
      } catch (importError) {
        console.error(LOG_PREFIX, "Failed to import from hash", importError);
        toast.error("Could not import converter result");
      } finally {
        markHashImportSettled();
      }
    };

    void runImport();
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromHash };
