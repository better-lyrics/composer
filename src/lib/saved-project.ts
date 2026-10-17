import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import type { LyricLine } from "@/domain/line/model";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { GranularityMode } from "@/stores/project";
import type { TtmlEditState } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface SavedProject {
  version: 1 | 2 | 3;
  savedAt: number;
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups?: LinkGroup[];
  granularity: GranularityMode;
  exportTiming?: TimingGranularity;
  syllableSplitDefaults?: SyllableSplitDefaults;
  audioFileName?: string;
  audioSource?: SavedAudioSource;
  dismissedSuggestions?: string[];
  dismissedExplicitSuggestions?: string[];
  currentStem?: Stem;
  primingStripped?: boolean;
  customSnapPoints?: (SnapPoint | number)[];
  hasUnexportedImport?: boolean;
  importedMetadataKeys?: MetadataKey[];
  ttmlEditState?: TtmlEditState;
}

interface SavedAudioFile {
  name: string;
  type: string;
  data: ArrayBuffer;
}

// -- Constants ----------------------------------------------------------------

const SAVED_PROJECT_VERSION = 3;

// -- Upgrade ------------------------------------------------------------------

function upgradeSavedProject(project: SavedProject): boolean {
  if (project.version >= SAVED_PROJECT_VERSION) return false;
  if (Array.isArray(project.lines)) project.lines = project.lines.map(migrateLegacyTransliterationLine);
  project.version = SAVED_PROJECT_VERSION;
  return true;
}

// -- Exports ------------------------------------------------------------------

export { SAVED_PROJECT_VERSION, upgradeSavedProject };
export type { SavedProject, SavedAudioFile };
