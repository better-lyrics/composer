import { DEFAULT_AGENTS } from "insync/agent-colors";
import type { LyricLine } from "insync/line";
import { findOpenProjectId } from "@/lib/open-project-session";
import type { ProjectSaveInput } from "@/lib/persistence";
import { loadProjectAudio, saveProjectAudio } from "@/lib/project-audio";
import { saveProjectRecord, setOpenProjectId } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import {
  SAVED_PROJECT_VERSION,
  type SavedProject,
  type SavedProjectV3,
  type StoredProject,
  linesFromSaved,
  savedLines,
  upgradeSavedProject,
} from "@/lib/saved-project";
import { createLine, createProjectSaveInput } from "@/test/factories";
import { savedLinesV3 } from "@/test/saved-v3";

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
    lines: savedLines([
      createLine({ text: "Waiting in a car", begin: 1, end: 2 }),
      createLine({ text: "Waiting for a ride" }),
    ]),
    granularity: "word",
    primingStripped: true,
    primingCorrected: true,
    ...overrides,
  };
}

// A record saved before format 4, with the same default lines.
function v3StoredProject(overrides: Partial<SavedProjectV3> = {}): SavedProjectV3 {
  const { version: _version, lines, ...fields } = storedProject();
  return { ...fields, version: 3, lines: savedLinesV3(linesFromSaved(lines)), ...overrides };
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
    primingCorrected: true,
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

async function loadOpenProjectRecord(): Promise<StoredProject | undefined> {
  const id = await findOpenProjectId();
  return id ? loadProjectRecord(id) : undefined;
}

// The lines a stored record opens with, whichever format saved it.
function linesOfRecord(project: StoredProject | undefined): LyricLine[] {
  return project ? linesFromSaved(upgradeSavedProject(project).lines) : [];
}

async function loadOpenProjectAudio(): Promise<File | undefined> {
  const id = await findOpenProjectId();
  return id ? loadProjectAudio(id) : undefined;
}

// -- Exports ------------------------------------------------------------------

export {
  storedProject,
  v3StoredProject,
  songTitled,
  saveInputTitled,
  seedStoredProject,
  linesOfRecord,
  loadOpenProjectRecord,
  loadOpenProjectAudio,
};
