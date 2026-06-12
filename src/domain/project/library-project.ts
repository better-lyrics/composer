import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SavedAudioSource } from "@/lib/persistence";
import type { GranularityMode } from "@/stores/project";
import type { SyllableSplitDefaults } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface LibraryProject {
  version: 1;
  id: string;
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups: LinkGroup[];
  granularity: GranularityMode;
  syllableSplitDefaults: SyllableSplitDefaults;
  audioSource?: SavedAudioSource;
  audioBytesCached: boolean;
  dismissedSuggestions: string[];
  dismissedExplicitSuggestions: string[];
  currentStem: Stem;
  primingStripped?: boolean;

  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  pinned?: boolean;
  cachedWaveformDataUrl?: string;
}

// -- Exports ------------------------------------------------------------------

export type { LibraryProject };
