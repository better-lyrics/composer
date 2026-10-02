import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { ProjectTab } from "@/domain/project/tab";
import type { SnapPoint } from "@/domain/snap-point/model";
import { ensureOpenProjectId, findOpenProjectId } from "@/lib/open-project-session";
import { deleteProjectAudio, saveProjectAudio } from "@/lib/project-audio";
import { saveProjectRecord } from "@/lib/project-repository";
import { SAVED_PROJECT_VERSION, type SavedProject } from "@/lib/saved-project";
import type { GranularityMode } from "@/stores/project";
import type { TtmlEditState } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface ProjectSaveInput {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups: LinkGroup[];
  granularity: GranularityMode;
  exportTiming: TimingGranularity;
  syllableSplitDefaults: SyllableSplitDefaults;
  audioSource: SavedAudioSource | undefined;
  dismissedSuggestions: string[];
  dismissedExplicitSuggestions: string[];
  currentStem: Stem;
  primingStripped: boolean;
  customSnapPoints: SnapPoint[];
  hasUnexportedImport: boolean;
  importedMetadataKeys: MetadataKey[];
  ttmlEditState: TtmlEditState;
}

// -- Records ------------------------------------------------------------------

function buildSavedProject(input: ProjectSaveInput): SavedProject {
  const audioFileName = input.audioSource?.kind === "file" ? input.audioSource.name : undefined;
  return { version: SAVED_PROJECT_VERSION, savedAt: Date.now(), ...input, audioFileName };
}

async function saveProjectTo(target: Promise<string>, input: ProjectSaveInput, lastTab?: ProjectTab): Promise<void> {
  const project = buildSavedProject(input);
  await saveProjectRecord(await target, project, lastTab);
}

// -- Public API ---------------------------------------------------------------

function saveCurrentProject(input: ProjectSaveInput, lastTab?: ProjectTab): Promise<void> {
  return saveProjectTo(ensureOpenProjectId(), input, lastTab);
}

// -- Audio File Persistence ---------------------------------------------------

async function saveAudioFile(file: File): Promise<void> {
  await saveProjectAudio(await ensureOpenProjectId(), file);
}

async function clearAudioFile(): Promise<void> {
  const id = await findOpenProjectId();
  if (id) await deleteProjectAudio(id);
}

// -- Exports ------------------------------------------------------------------

export { buildSavedProject, saveProjectTo, saveCurrentProject, saveAudioFile, clearAudioFile };
export type { ProjectSaveInput };
