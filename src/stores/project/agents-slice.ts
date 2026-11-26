import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { removeSinger } from "@/domain/commands/lyrics-replace";
import type { AgentActions, AgentsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createAgentsInitialState(): AgentsState {
  return {
    agents: DEFAULT_AGENTS,
  };
}

// -- Slice --------------------------------------------------------------------

const createAgentsSlice: StateCreator<ProjectStore, [], [], AgentsState & AgentActions> = (set, get) => ({
  ...createAgentsInitialState(),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
      isDirty: true,
      isDirtySinceHistory: true,
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      isDirty: true,
      isDirtySinceHistory: true,
    })),

  removeAgentWithHistory: (id) => {
    get().commit(removeSinger(id));
  },

  setAgents: (agents) => set({ agents, isDirty: true, isDirtySinceHistory: true }),
});

// -- Exports ------------------------------------------------------------------

export { createAgentsSlice, createAgentsInitialState };
