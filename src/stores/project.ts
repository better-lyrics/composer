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
}

type GranularityMode = "line" | "word";
type EditorMode = "simple" | "advanced";
type SimpleTab = "import" | "edit" | "sync" | "preview" | "export";

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

const DEFAULT_AGENTS: Agent[] = [{ id: "v1", type: "person", name: "Primary" }];

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

export { useProjectStore, DEFAULT_AGENTS, INITIAL_STATE };
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
