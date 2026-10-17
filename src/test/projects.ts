import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { findOpenProjectId } from "@/lib/open-project-session";
import type { ProjectSaveInput } from "@/lib/persistence";
import { loadProjectAudio, saveProjectAudio } from "@/lib/project-audio";
import { saveProjectRecord, setOpenProjectId } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import { SAVED_PROJECT_VERSION, type SavedProject } from "@/lib/saved-project";
import { createLine, createProjectSaveInput } from "@/test/factories";

// -- Types --------------------------------------------------------------------

interface SeedOptions {
  project?: Partial<SavedProject>;
  audio?: File;
  open?: boolean;
}

// -- Fixtures -----------------------------------------------------------------

function storedProject(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: 1_758_900_000_000,
    metadata: { title: "Midnight City", artists: ["M83"], album: "Hurry Up, We're Dreaming", duration: 243 },
    agents: DEFAULT_AGENTS,
    lines: [createLine({ text: "Waiting in a car", begin: 1, end: 2 }), createLine({ text: "Waiting for a ride" })],
    granularity: "word",
    primingStripped: true,
    ...overrides,
  };
}

function songTitled(title: string): Pick<SavedProject, "metadata"> {
  return { metadata: { title, artists: [], album: "", duration: 0 } };
}

function saveInputTitled(title: string): ProjectSaveInput {
  return createProjectSaveInput({
    metadata: { title, artists: [], album: "", duration: 0 },
    lines: [createLine({ text: `${title} line` })],
    audioSource: undefined,
    primingStripped: true,
  });
}

// -- Seeding ------------------------------------------------------------------

async function seedStoredProject(id: string, options: SeedOptions = {}): Promise<SavedProject> {
  const project = storedProject(options.project);
  await saveProjectRecord(id, project);
  if (options.audio) await saveProjectAudio(id, options.audio);
  if (options.open) await setOpenProjectId(id);
  return project;
}

// -- Reading ------------------------------------------------------------------

async function loadOpenProjectRecord(): Promise<SavedProject | undefined> {
  const id = await findOpenProjectId();
  return id ? loadProjectRecord(id) : undefined;
}

async function loadOpenProjectAudio(): Promise<File | undefined> {
  const id = await findOpenProjectId();
  return id ? loadProjectAudio(id) : undefined;
}

// -- Exports ------------------------------------------------------------------

export { storedProject, songTitled, saveInputTitled, seedStoredProject, loadOpenProjectRecord, loadOpenProjectAudio };
