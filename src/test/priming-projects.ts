import { msFromSeconds, secondsFromMs } from "insync/time";
import { DEFAULT_AGENTS } from "insync/agent-colors";
import type { TrackRole } from "insync/line";
import { roleWords } from "insync/line-track";
import type { WordTiming } from "insync/word-timing";
import { lineFromFields } from "insync/line-from-fields";
import { newWordId } from "insync/word-id";
import { type ProjectSaveInput, saveCurrentProject } from "@/lib/persistence";
import { loadProjectForRestore } from "@/lib/project-restore";
import { getOpenProjectId } from "@/lib/project-storage";
import { type SavedProject, linesFromSaved } from "@/lib/saved-project";
import { createProjectSaveInput } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Helpers ------------------------------------------------------------------

function seedSavedProject(
  opts: { primingStripped: boolean; primingCorrected?: boolean } & Partial<ProjectSaveInput>,
): Promise<void> {
  const { primingStripped, primingCorrected = true, ...overrides } = opts;
  return saveCurrentProject(
    createProjectSaveInput({
      lines: [
        lineFromFields(
          {
            id: "L1",
            text: "hello world",
            agentId: DEFAULT_AGENTS[0].id,
            words: [
              { id: newWordId(), text: "hello", sep: "", begin: 1.0, end: 1.5, joinsNext: true },
              { id: newWordId(), text: "world", sep: "", begin: 1.5, end: 2.0, joinsNext: false },
            ],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
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

// The timed syllables of one of a restored project's lines.
function restoredWords(project: SavedProject | undefined, lineIndex = 0, role: TrackRole = "main"): WordTiming[] {
  const line = project && linesFromSaved(project.lines)[lineIndex];
  return line ? (roleWords(line, role) ?? []) : [];
}

// A time as a format 4 save keeps it.
function savedTime(seconds: number): number {
  return secondsFromMs(msFromSeconds(seconds));
}

// -- Exports ------------------------------------------------------------------

export { loadOpenProjectForRestore, restoredWords, savedTime, seedSavedProject };
