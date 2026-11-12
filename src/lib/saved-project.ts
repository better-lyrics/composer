import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import type { LyricLine } from "@/domain/line/model";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { StoredData } from "@/domain/storage/stored-data";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
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
  dismissedMetadataMatches?: string[];
  currentStem?: Stem;
  primingStripped?: boolean;
  primingCorrected?: boolean;
  customSnapPoints?: (SnapPoint | number)[];
  beatGrid?: unknown;
  hasUnexportedImport?: boolean;
  importedMetadataKeys?: MetadataKey[];
  ttmlEditState?: TtmlEditState;
  alignedTimings?: unknown;
  alignmentNoticeDismissed?: boolean;
  unisonLyricId?: string;
  playedRanges?: unknown;
}

interface SavedAudioFile {
  name: string;
  type: string;
  data: StoredData;
}

// -- Constants ----------------------------------------------------------------

const SAVED_PROJECT_VERSION = 3;

// -- Errors -------------------------------------------------------------------

class NewerProjectError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`Project ${projectId} was saved by a newer version of Composer`);
    this.name = "NewerProjectError";
    this.projectId = projectId;
  }
}

// -- Upgrade ------------------------------------------------------------------

function isFromNewerComposer(saved: { version?: number } | undefined): boolean {
  return (saved?.version ?? 0) > SAVED_PROJECT_VERSION;
}

function upgradeSavedProject(project: SavedProject): boolean {
  if (project.version >= SAVED_PROJECT_VERSION) return false;
  if (Array.isArray(project.lines)) project.lines = project.lines.map(migrateLegacyTransliterationLine);
  project.version = SAVED_PROJECT_VERSION;
  return true;
}

// -- Exports ------------------------------------------------------------------

export type { SavedAudioFile, SavedProject };
export { NewerProjectError, SAVED_PROJECT_VERSION, isFromNewerComposer, upgradeSavedProject };
