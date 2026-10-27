import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { type ProjectSaveInput, saveCurrentProject } from "@/lib/persistence";
import { loadProjectForRestore } from "@/lib/project-restore";
import { getOpenProjectId } from "@/lib/project-storage";
import type { SavedProject } from "@/lib/saved-project";
import { createProjectSaveInput } from "@/test/factories";

// -- Helpers ------------------------------------------------------------------

function seedSavedProject(
  opts: { primingStripped: boolean; primingCorrected?: boolean } & Partial<ProjectSaveInput>,
): Promise<void> {
  const { primingStripped, primingCorrected = true, ...overrides } = opts;
  return saveCurrentProject(
    createProjectSaveInput({
      lines: [
        {
          id: "L1",
          text: "hello world",
          agentId: DEFAULT_AGENTS[0].id,
          words: [
            { text: "hello", begin: 1.0, end: 1.5 },
            { text: "world", begin: 1.5, end: 2.0 },
          ],
        },
      ],
      primingStripped,
      primingCorrected,
      ...overrides,
    }),
  );
}

async function loadOpenProjectForRestore(): Promise<SavedProject | undefined> {
  const id = await getOpenProjectId();
  return id ? (await loadProjectForRestore(id)).project : undefined;
}

// -- Exports ------------------------------------------------------------------

export { loadOpenProjectForRestore, seedSavedProject };
