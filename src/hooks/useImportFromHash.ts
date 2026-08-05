import { getPersistenceSettled, markHashImportSettled } from "@/lib/persistence-settled";
import { isProjectNonEmpty } from "@/lib/project-non-empty";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
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
    payload.metadata !== null &&
    typeof payload.metadata === "object" &&
    Array.isArray(payload.agents) &&
    Array.isArray(payload.lines) &&
    (payload.granularity === "line" || payload.granularity === "word")
  );
}

function useImportFromHash(): void {
  const confirm = useConfirm();

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
          console.error("[Composer] Invalid import payload structure");
          toast.error("Could not import converter result");
          return;
        }

        if (import.meta.env.DEV) console.log("[Boot] useImportFromHash awaiting settled");
        await getPersistenceSettled();
        if (import.meta.env.DEV) console.log("[Boot] useImportFromHash settled");

        if (await isProjectNonEmpty()) {
          const ok = await confirm({
            title: "Replace current project?",
            description:
              "This URL contains imported lyrics that will replace your current project. Your existing work will be lost permanently.",
            confirmLabel: "Replace project",
            variant: "destructive",
            settingsKey: "confirmReplaceProjectFromHash",
          });
          if (!ok) {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            return;
          }
        }

        // Everything the import needs is built before the project is cleared, so
        // a malformed payload can never leave the user with an emptied project.
        const metadata = normalizeLoadedMetadata(payload.metadata);

        const state = useProjectStore.getState();
        state.reset();
        state.setMetadata(metadata);
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
      } finally {
        markHashImportSettled();
      }
    };

    void runImport();
  }, [confirm]);
}

export { useImportFromHash };
