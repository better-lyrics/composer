import type { Agent } from "@/domain/agent/model";
import type { LineTemplate, LinkGroup } from "@/domain/group/template";
import type { LineUpdate, LyricLine, RawLine } from "@/domain/line/model";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Store-local Types --------------------------------------------------------

type GranularityMode = "line" | "word";
type EditorMode = "simple" | "advanced";
type SimpleTab = "import" | "edit" | "languages" | "sync" | "timeline" | "preview" | "export";
type TtmlEditState = { source: string; content: string } | null;

interface SyllableSplitDefaults {
  applyToAll: boolean;
  caseInsensitive: boolean;
}

const DEFAULT_SYLLABLE_SPLIT_DEFAULTS: SyllableSplitDefaults = {
  applyToAll: false,
  caseInsensitive: false,
};

interface HistoryEntry {
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[];
  customSnapPoints: SnapPoint[];
  timestamp: number;
}

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
  editorMode: EditorMode;
  activeTab: SimpleTab;
  syllableSplitDefaults: SyllableSplitDefaults;
  primingStripped: boolean;
}

interface DismissalsState {
  dismissedSuggestions: string[];
  dismissedExplicitSuggestions: string[];
}

interface SnapPointsState {
  customSnapPoints: SnapPoint[];
}

interface HistoryState {
  isDirty: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  // True when any snapshotted state (lines, groups, agents) has changed since
  // the last history entry was written (e.g., per-keystroke setLines from the
  // Edit textarea). The next history-aware mutator, and undo itself, snapshot
  // this state first so undo lands on the pending edit instead of skipping it.
  isDirtySinceHistory: boolean;
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
  markSongDetailsImported: () => void;
  restoreImportedMetadataKeys: (keys: MetadataKey[]) => void;
  clearUnexportedImport: () => void;
  setTtmlEditState: (editState: TtmlEditState | ((current: TtmlEditState) => TtmlEditState)) => void;
  reset: () => void;
}

interface AgentActions {
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgentWithHistory: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
}

interface UiActions {
  setGranularity: (mode: GranularityMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveTab: (tab: SimpleTab) => void;
  setSyllableSplitDefaults: (defaults: SyllableSplitDefaults) => void;
  setPrimingStripped: (value: boolean) => void;
}

interface DismissalActions {
  dismissSuggestion: (fingerprint: string) => void;
  setDismissedSuggestions: (fingerprints: string[]) => void;
  clearDismissedSuggestions: () => void;
  dismissExplicitSuggestion: (fingerprint: string) => void;
  setDismissedExplicitSuggestions: (fingerprints: string[]) => void;
  clearDismissedExplicitSuggestions: () => void;
}

interface SnapPointActions {
  setCustomSnapPoints: (points: (SnapPoint | number)[]) => void;
  addCustomSnapPoint: (time: number) => void;
  removeCustomSnapPoint: (id: string) => void;
  moveCustomSnapPoint: (id: string, time: number) => void;
  commitSnapPointDrag: (baseline: SnapPoint[]) => void;
  clearCustomSnapPoints: () => void;
}

interface HistoryActions {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  markDirty: () => void;
  markClean: () => void;
  commitPendingLineEdit: (baseline: LyricLine[], baselineWasDirty?: boolean) => void;
}

interface LineActions {
  setLines: (lines: RawLine[]) => void;
  // See the JSDoc on the implementation in lines-slice.ts before using this.
  setTransientLines: (lines: RawLine[]) => void;
  setLinesWithHistory: (lines: RawLine[], groups?: LinkGroup[]) => void;
  insertEmptyLineWithHistory: (anchorLineId: string, position: "above" | "below") => void;
  updateLine: (id: string, updates: Partial<LyricLine>, options?: { deriveText?: boolean }) => void;
  updateLineWithHistory: (
    id: string,
    updates: Partial<LyricLine>,
    options?: { deriveText?: boolean; propagateToSiblings?: boolean },
  ) => void;
  updateLinesWithHistory: (
    updates: LineUpdate[],
    options?: { deriveText?: boolean; propagateToSiblings?: boolean },
  ) => void;
  moveWordToBg: (lineId: string, wordIndices: number[], timeDelta: number, duration: number) => void;
  moveWordFromBg: (lineId: string, wordIndices: number[], timeDelta: number, duration: number) => void;
  applyWordCountChange: (
    lineId: string,
    newWords: WordTiming[],
    field: "words" | "backgroundWords",
    resolution: "apply" | "detach" | "cancel",
    extraUpdates?: Partial<LyricLine>,
  ) => void;
  toggleWordExplicit: (lineId: string, field: "words" | "backgroundWords", wordIndices: number[]) => void;
  mergeSyllableGroupIntoWord: (lineId: string, field: "words" | "backgroundWords", wordIndices: number[]) => void;
  snapSyllablesFlush: (lineId: string, field: "words" | "backgroundWords") => void;
  markWordsExplicit: (
    targets: Array<{ lineId: string; field: "words" | "backgroundWords"; wordIndex: number }>,
    value: boolean,
  ) => void;
  splitSyllablesAcrossIdenticalWordsWithHistory: (params: {
    source: { lineId: string; wordIndex: number; type: "word" | "bg" };
    splitPoints: number[];
    caseInsensitive: boolean;
  }) => void;
}

interface GroupActions {
  setGroups: (groups: LinkGroup[]) => void;
  addGroup: (group: LinkGroup) => void;
  addGroupWithLines: (group: LinkGroup, lines: LyricLine[]) => void;
  groupRepeatingSections: (starts: number[], length: number, options?: { label?: string; color?: string }) => void;
  updateGroup: (id: string, updates: Partial<LinkGroup>) => void;
  removeGroup: (id: string) => void;
  addInstance: (groupId: string, structure: LineTemplate[], instanceStart: number, insertAtIndex?: number) => void;
  removeInstance: (groupId: string, instanceIdx: number) => void;
  detachLine: (lineId: string) => void;
  shiftInstance: (groupId: string, instanceIdx: number, deltaSeconds: number) => void;
}

// -- Composed Store -----------------------------------------------------------

type ProjectState = MetadataState &
  AgentsState &
  LinesState &
  GroupsState &
  UiState &
  DismissalsState &
  SnapPointsState &
  HistoryState;

type ProjectActions = MetadataActions &
  AgentActions &
  UiActions &
  DismissalActions &
  SnapPointActions &
  HistoryActions &
  LineActions &
  GroupActions;

type ProjectStore = ProjectState & ProjectActions;

// -- Exports ------------------------------------------------------------------

export type {
  GranularityMode,
  SimpleTab,
  SyllableSplitDefaults,
  TtmlEditState,
  MetadataState,
  SongIdentity,
  AgentsState,
  LinesState,
  GroupsState,
  UiState,
  DismissalsState,
  SnapPointsState,
  HistoryEntry,
  HistoryState,
  MetadataActions,
  AgentActions,
  UiActions,
  DismissalActions,
  SnapPointActions,
  HistoryActions,
  LineActions,
  GroupActions,
  ProjectState,
  ProjectStore,
};
export { DEFAULT_SYLLABLE_SPLIT_DEFAULTS };
