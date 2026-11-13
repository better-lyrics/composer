import type { AlignmentReviewActions, AlignmentReviewState } from "@/stores/project/alignment-review-slice";
import type { Agent } from "@/domain/agent/model";
import type { LyricRoot } from "@/domain/commands/outcome";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine, RawLine } from "@/domain/line/model";
import type { EditedLyrics } from "@/domain/project/edited-lyrics";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { ProjectTab } from "@/domain/project/tab";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import type { HistoryActions, HistoryState } from "@/stores/project/history-types";
import type { UnisonLinkActions, UnisonLinkState } from "@/stores/project/unison-link-slice";

// -- Store-local Types --------------------------------------------------------

type GranularityMode = "line" | "word";
type EditorMode = "simple" | "advanced";
type TtmlEditState = { source: string; content: string; lyricsChanged?: true } | null;

// -- Segregated State Slices --------------------------------------------------

interface MetadataState {
  metadata: ProjectMetadata;
  /** In-memory identity for replacements, including files that reuse line IDs. */
  projectSession: number;
  hasUnexportedImport: boolean;
  importedMetadataKeys: MetadataKey[];
  ttmlEditState: TtmlEditState;
}

interface SongIdentity {
  metadata: ProjectMetadata;
  agents: Agent[];
  hasUnexportedImport: boolean;
  importedMetadataKeys: MetadataKey[];
}

interface AgentsState {
  agents: Agent[];
}

interface LinesState {
  lines: LyricLine[];
}

interface GroupsState {
  groups: LinkGroup[];
}

interface UiState {
  granularity: GranularityMode;
  exportTiming: TimingGranularity;
  editorMode: EditorMode;
  activeTab: ProjectTab;
  syllableSplitDefaults: SyllableSplitDefaults;
  primingStripped: boolean;
  primingCorrected: boolean;
}

interface DismissalsState {
  dismissedSuggestions: string[];
  dismissedExplicitSuggestions: string[];
  dismissedMetadataMatches: string[];
}

interface SnapPointsState {
  customSnapPoints: SnapPoint[];
}

interface BeatGridState {
  beatGrid: BeatGrid | null;
}

// -- Segregated Action Slices -------------------------------------------------

interface MetadataActions {
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  startProjectSession: () => void;
  resetSongIdentity: (title: string) => void;
  restoreSongIdentity: (identity: SongIdentity) => void;
  replaceLyricsWithHistory: (input: {
    lines: RawLine[];
    groups: LinkGroup[];
    agents: Agent[] | undefined;
    metadata: Partial<ProjectMetadata>;
  }) => void;
  applyEditedLyricsWithHistory: (edited: EditedLyrics) => void;
  markSongDetailsImported: () => void;
  restoreImportedMetadataKeys: (keys: MetadataKey[]) => void;
  clearUnexportedImport: () => void;
  setTtmlEditState: (editState: TtmlEditState | ((current: TtmlEditState) => TtmlEditState)) => void;
  reset: () => void;
}

interface AgentActions {
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
}

interface UiActions {
  setGranularity: (mode: GranularityMode) => void;
  setExportTiming: (timing: TimingGranularity) => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveTab: (tab: ProjectTab) => void;
  setSyllableSplitDefaults: (defaults: SyllableSplitDefaults) => void;
  setPrimingStripped: (value: boolean) => void;
  setPrimingCorrected: (value: boolean) => void;
}

interface DismissalActions {
  dismissSuggestion: (fingerprint: string) => void;
  setDismissedSuggestions: (fingerprints: string[]) => void;
  clearDismissedSuggestions: () => void;
  restoreSuggestions: (fingerprints: readonly string[]) => void;
  dismissExplicitSuggestion: (fingerprint: string) => void;
  setDismissedExplicitSuggestions: (fingerprints: string[]) => void;
  clearDismissedExplicitSuggestions: () => void;
  restoreExplicitSuggestions: (fingerprints: readonly string[]) => void;
  dismissMetadataMatch: (recordingId: string) => void;
  setDismissedMetadataMatches: (recordingIds: string[]) => void;
}

interface SnapPointActions {
  setCustomSnapPoints: (points: (SnapPoint | number)[]) => void;
  addCustomSnapPoint: (time: number) => void;
  removeCustomSnapPoint: (id: string) => void;
  moveCustomSnapPoint: (id: string, time: number) => void;
  commitSnapPointDrag: (baseline: SnapPoint[]) => void;
  clearCustomSnapPoints: () => void;
}

interface BeatGridActions {
  setBeatGrid: (grid: BeatGrid | null) => void;
  applyBeatGridWithHistory: (grid: BeatGrid | null) => void;
  nudgeBeatGridOffsetWithHistory: (grid: BeatGrid) => void;
  clearBeatGrid: () => void;
}

interface LineActions {
  // Loads and restores only: the one write of lines, groups and agents outside commands.
  restoreLyrics: (root: Partial<LyricRoot>) => void;
  previewLines: (lines: RawLine[]) => void;
  restorePreviewLines: (lines: RawLine[]) => void;
}

// -- Composed Store -----------------------------------------------------------

type ProjectState = MetadataState &
  AgentsState &
  LinesState &
  GroupsState &
  UiState &
  DismissalsState &
  SnapPointsState &
  BeatGridState &
  AlignmentReviewState &
  UnisonLinkState &
  HistoryState;

type ProjectActions = MetadataActions &
  AgentActions &
  UiActions &
  DismissalActions &
  SnapPointActions &
  BeatGridActions &
  HistoryActions &
  LineActions &
  AlignmentReviewActions &
  UnisonLinkActions;

type ProjectStore = ProjectState & ProjectActions;

// -- Exports ------------------------------------------------------------------

export type {
  GranularityMode,
  TtmlEditState,
  MetadataState,
  SongIdentity,
  AgentsState,
  LinesState,
  GroupsState,
  UiState,
  DismissalsState,
  SnapPointsState,
  BeatGridState,
  MetadataActions,
  AgentActions,
  UiActions,
  DismissalActions,
  SnapPointActions,
  BeatGridActions,
  LineActions,
  ProjectState,
  ProjectStore,
};
