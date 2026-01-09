import { useAudioStore } from "@/stores/audio";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AgentType = "person" | "character" | "group" | "organization" | "other";

interface Agent {
  id: string;
  type: AgentType;
  name?: string;
}

interface SyllableTiming {
  text: string;
  begin: number;
  end: number;
}

interface WordTiming {
  text: string;
  begin: number;
  end: number;
  syllables?: SyllableTiming[];
}

interface LyricLine {
  id: string;
  text: string;
  agentId: string;
  begin?: number;
  end?: number;
  words?: WordTiming[];
  backgroundText?: string;
  backgroundWords?: WordTiming[];
}

type GranularityMode = "line" | "word";
type EditorMode = "simple" | "advanced";
type SimpleTab = "import" | "edit" | "sync" | "timeline" | "preview" | "export";

interface ProjectMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  language?: string;
}

interface HistoryEntry {
  lines: LyricLine[];
  timestamp: number;
}

interface ProjectState {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: GranularityMode;
  editorMode: EditorMode;
  activeTab: SimpleTab;
  isDirty: boolean;
  history: HistoryEntry[];
  historyIndex: number;
}

interface ProjectActions {
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  setLines: (lines: LyricLine[]) => void;
  updateLine: (id: string, updates: Partial<LyricLine>) => void;
  updateLineWithHistory: (id: string, updates: Partial<LyricLine>) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  setGranularity: (mode: GranularityMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveTab: (tab: SimpleTab) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

// -- Constants ----------------------------------------------------------------

const AGENT_PRESETS: Agent[] = [
  { id: "v1", type: "person", name: "Lead" },
  { id: "v1000", type: "group", name: "Harmony" },
  { id: "v2000", type: "other", name: "Chorus" },
];

const AGENT_COLORS: Record<string, string> = {
  v1: "#60a5fa", // blue
  v2: "#4ade80", // green
  v3: "#fb923c", // orange
  v4: "#22d3d1", // cyan
  v5: "#facc15", // yellow
  v6: "#fb7185", // rose
  v7: "#2dd4bf", // teal
  v8: "#fbbf24", // amber
  v9: "#818cf8", // indigo
  v10: "#34d399", // emerald
  v11: "#f87171", // red
  v12: "#38bdf8", // sky
  v13: "#a3e635", // lime
  v14: "#e879f9", // fuchsia
  v15: "#a78bfa", // violet
  v1000: "#f472b6", // pink
  v2000: "#c4b5fd", // purple light
};

const DEFAULT_AGENTS: Agent[] = [AGENT_PRESETS[0]];

const MAX_HISTORY_SIZE = 100;

const INITIAL_STATE: ProjectState = {
  metadata: {
    title: "",
    artist: "",
    album: "",
    duration: 0,
  },
  agents: DEFAULT_AGENTS,
  lines: [],
  granularity: "word",
  editorMode: "simple",
  activeTab: "import",
  isDirty: false,
  history: [],
  historyIndex: -1,
};

// -- Store --------------------------------------------------------------------

const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  ...INITIAL_STATE,

  setMetadata: (metadata) =>
    set((state) => ({
      metadata: { ...state.metadata, ...metadata },
      isDirty: true,
    })),

  setLines: (lines) => set({ lines, isDirty: true }),

  updateLine: (id, updates) =>
    set((state) => ({
      lines: state.lines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
      isDirty: true,
    })),

  updateLineWithHistory: (id, updates) =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        lines: JSON.parse(JSON.stringify(state.lines)),
        timestamp: Date.now(),
      });
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }
      return {
        lines: state.lines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
        isDirty: true,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
      isDirty: true,
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      isDirty: true,
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      isDirty: true,
    })),

  setGranularity: (granularity) => set({ granularity, isDirty: true }),

  setEditorMode: (editorMode) => set({ editorMode }),

  setActiveTab: (activeTab) => {
    if (activeTab === "export") {
      useAudioStore.getState().setIsPlaying(false);
    }
    set({ activeTab });
  },

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  reset: () => set(INITIAL_STATE),

  undo: () =>
    set((state) => {
      if (state.historyIndex < 0) return state;
      const entry = state.history[state.historyIndex];
      return {
        lines: JSON.parse(JSON.stringify(entry.lines)),
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const entry = state.history[state.historyIndex + 1];
      return {
        lines: JSON.parse(JSON.stringify(entry.lines)),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }),

  canUndo: () => get().historyIndex >= 0,

  canRedo: () => get().historyIndex < get().history.length - 1,

  clearHistory: () => set({ history: [], historyIndex: -1 }),
}));

function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId] ?? "#9ca3af"; // gray fallback
}

export { useProjectStore, DEFAULT_AGENTS, AGENT_PRESETS, AGENT_COLORS, getAgentColor, INITIAL_STATE };
export type {
  Agent,
  AgentType,
  EditorMode,
  GranularityMode,
  LyricLine,
  ProjectMetadata,
  ProjectState,
  SimpleTab,
  SyllableTiming,
  WordTiming,
};
