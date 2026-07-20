import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SnapPoint } from "@/domain/snap-point/model";
import { PROJECT_STORE_NAME, deleteFromStore, getFromStore, setInStore } from "@/lib/persistence-idb";
import type { GranularityMode } from "@/stores/project";
import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS, type SyllableSplitDefaults } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

type SavedAudioSource = { kind: "file"; name: string } | { kind: "youtube"; videoId: string };

interface SavedProject {
  version: 1 | 2;
  savedAt: number;
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups?: LinkGroup[];
  granularity: GranularityMode;
  syllableSplitDefaults?: SyllableSplitDefaults;
  audioFileName?: string;
  audioSource?: SavedAudioSource;
  dismissedSuggestions?: string[];
  dismissedExplicitSuggestions?: string[];
  currentStem?: Stem;
  primingStripped?: boolean;
  customSnapPoints?: (SnapPoint | number)[];
}

// -- Constants ----------------------------------------------------------------

const CURRENT_PROJECT_KEY = "current";
const AUDIO_FILE_KEY = "current-audio";

// -- Public API ---------------------------------------------------------------

async function saveCurrentProject(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  groups: LinkGroup[],
  granularity: GranularityMode,
  syllableSplitDefaults: SyllableSplitDefaults,
  audioSource: SavedAudioSource | undefined,
  dismissedSuggestions: string[],
  dismissedExplicitSuggestions: string[],
  currentStem: Stem,
  primingStripped: boolean,
  customSnapPoints: SnapPoint[],
): Promise<void> {
  const audioFileName = audioSource?.kind === "file" ? audioSource.name : undefined;
  const project: SavedProject = {
    version: 2,
    savedAt: Date.now(),
    metadata,
    agents,
    lines,
    groups,
    granularity,
    syllableSplitDefaults,
    audioFileName,
    audioSource,
    dismissedSuggestions,
    dismissedExplicitSuggestions,
    currentStem,
    primingStripped,
    customSnapPoints,
  };
  await setInStore(PROJECT_STORE_NAME, CURRENT_PROJECT_KEY, project);
}

async function loadCurrentProject(): Promise<SavedProject | undefined> {
  const project = await getFromStore<SavedProject>(PROJECT_STORE_NAME, CURRENT_PROJECT_KEY);
  if (project?.version === 1) {
    project.version = 2;
    await setInStore(PROJECT_STORE_NAME, CURRENT_PROJECT_KEY, project);
  }
  return project;
}

async function replaceCurrentProject(project: SavedProject): Promise<void> {
  await setInStore(PROJECT_STORE_NAME, CURRENT_PROJECT_KEY, project);
}

async function clearCurrentProject(): Promise<void> {
  await deleteFromStore(PROJECT_STORE_NAME, CURRENT_PROJECT_KEY);
  await clearAudioFile();
}

// -- Audio File Persistence ---------------------------------------------------

interface SavedAudioFile {
  name: string;
  type: string;
  data: ArrayBuffer;
}

async function saveAudioFile(file: File): Promise<void> {
  const data = await file.arrayBuffer();
  await setInStore<SavedAudioFile>(PROJECT_STORE_NAME, AUDIO_FILE_KEY, {
    name: file.name,
    type: file.type,
    data,
  });
}

async function loadAudioFile(): Promise<File | undefined> {
  const saved = await getFromStore<SavedAudioFile>(PROJECT_STORE_NAME, AUDIO_FILE_KEY);
  if (!saved) return undefined;
  return new File([saved.data], saved.name, { type: saved.type });
}

async function clearAudioFile(): Promise<void> {
  await deleteFromStore(PROJECT_STORE_NAME, AUDIO_FILE_KEY);
}

function exportProjectToFile(
  metadata: ProjectMetadata,
  agents: Agent[],
  lines: LyricLine[],
  groups: LinkGroup[],
  granularity: GranularityMode,
  syllableSplitDefaults: SyllableSplitDefaults,
  dismissedSuggestions: string[],
  dismissedExplicitSuggestions: string[],
  customSnapPoints: SnapPoint[],
  audioFileName?: string,
): void {
  const project: SavedProject = {
    version: 2,
    savedAt: Date.now(),
    metadata,
    agents,
    lines,
    groups,
    granularity,
    syllableSplitDefaults,
    audioFileName,
    dismissedSuggestions,
    dismissedExplicitSuggestions,
    customSnapPoints,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${metadata.title || "project"}-${new Date().toISOString().slice(0, 10)}.ttml-project.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importProjectFromFile(file: File): Promise<SavedProject> {
  const text = await file.text();
  const project = JSON.parse(text) as SavedProject;

  if (project.version !== 1 && project.version !== 2) {
    throw new Error(`Unsupported project version: ${project.version}`);
  }

  if (!project.syllableSplitDefaults) {
    project.syllableSplitDefaults = DEFAULT_SYLLABLE_SPLIT_DEFAULTS;
  }
  // V2 adds optional translation/transliteration fields to lyric lines. V1
  // lines are already structurally valid, so migration only updates the
  // envelope version and preserves the original lyric objects verbatim.
  project.version = 2;

  return project;
}

// -- Exports ------------------------------------------------------------------

export {
  saveCurrentProject,
  loadCurrentProject,
  replaceCurrentProject,
  clearCurrentProject,
  exportProjectToFile,
  importProjectFromFile,
  saveAudioFile,
  loadAudioFile,
  clearAudioFile,
};
export type { SavedAudioSource, SavedProject };
