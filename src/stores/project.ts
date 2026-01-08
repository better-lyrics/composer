import { useAudioStore } from "@/stores/audio";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AgentType = "person" | "character" | "group" | "organization" | "other";

interface Agent {
	id: string;
	type: AgentType;
	name?: string;
}

interface WordTiming {
	text: string;
	begin: number;
	end: number;
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

interface ProjectState {
	metadata: ProjectMetadata;
	agents: Agent[];
	lines: LyricLine[];
	granularity: GranularityMode;
	editorMode: EditorMode;
	activeTab: SimpleTab;
	isDirty: boolean;
}

interface ProjectActions {
	setMetadata: (metadata: Partial<ProjectMetadata>) => void;
	setLines: (lines: LyricLine[]) => void;
	updateLine: (id: string, updates: Partial<LyricLine>) => void;
	addAgent: (agent: Agent) => void;
	removeAgent: (id: string) => void;
	setGranularity: (mode: GranularityMode) => void;
	setEditorMode: (mode: EditorMode) => void;
	setActiveTab: (tab: SimpleTab) => void;
	markDirty: () => void;
	markClean: () => void;
	reset: () => void;
}

// -- Constants ----------------------------------------------------------------

const DEFAULT_AGENTS: Agent[] = [{ id: "v1", type: "person", name: "Primary" }];

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
};

// -- Store --------------------------------------------------------------------

const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
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
	WordTiming,
};
