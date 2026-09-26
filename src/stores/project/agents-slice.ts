import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { commitHistory } from "@/stores/project/history-helpers";
import type { AgentActions, AgentsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createAgentsInitialState(): AgentsState {
  return {
    agents: DEFAULT_AGENTS,
  };
}

// -- Slice --------------------------------------------------------------------

const createAgentsSlice: StateCreator<ProjectStore, [], [], AgentsState & AgentActions> = (set) => ({
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

  removeAgentWithHistory: (id) =>
    set((state) => {
      const fallback = state.agents.find((agent) => agent.id !== id);
      if (!fallback) return state;
      return commitHistory(
        state,
        {
          agents: state.agents.filter((agent) => agent.id !== id),
          lines: state.lines.map((line) => (line.agentId === id ? { ...line, agentId: fallback.id } : line)),
        },
        { deriveText: false },
      );
    }),

  setAgents: (agents) => set({ agents, isDirty: true, isDirtySinceHistory: true }),
});

// -- Exports ------------------------------------------------------------------

export { createAgentsSlice, createAgentsInitialState };
