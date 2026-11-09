import { create } from "zustand";
import { persist } from "zustand/middleware";

// -- Types --------------------------------------------------------------------

interface ProjectGuideFacts {
  visitedTimeline: boolean;
  visitedPreview: boolean;
  exported: boolean;
}

interface GuideState {
  learnedSignals: string[];
  mutedCategories: string[];
  seenNudges: string[];
  showAll: boolean;
  projects: Record<string, ProjectGuideFacts>;
  learnSignal: (signal: string) => void;
  muteCategory: (category: string) => void;
  markNudgeSeen: (id: string) => void;
  setShowAll: (showAll: boolean) => void;
  noteProjectFact: (projectId: string, fact: keyof ProjectGuideFacts) => void;
  forgetProject: (projectId: string) => void;
}

// -- Constants ----------------------------------------------------------------

const NO_PROJECT_FACTS: ProjectGuideFacts = { visitedTimeline: false, visitedPreview: false, exported: false };

const withId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

// -- Store --------------------------------------------------------------------

const useGuideStore = create<GuideState>()(
  persist(
    (set) => ({
      learnedSignals: [],
      mutedCategories: [],
      seenNudges: [],
      showAll: false,
      projects: {},
      learnSignal: (signal) => set((state) => ({ learnedSignals: withId(state.learnedSignals, signal) })),
      muteCategory: (category) => set((state) => ({ mutedCategories: withId(state.mutedCategories, category) })),
      markNudgeSeen: (id) => set((state) => ({ seenNudges: withId(state.seenNudges, id) })),
      setShowAll: (showAll) => set({ showAll }),
      noteProjectFact: (projectId, fact) =>
        set((state) => {
          const current = state.projects[projectId] ?? NO_PROJECT_FACTS;
          if (current[fact]) return state;
          return { projects: { ...state.projects, [projectId]: { ...current, [fact]: true } } };
        }),
      forgetProject: (projectId) =>
        set((state) => {
          if (!(projectId in state.projects)) return state;
          const { [projectId]: _forgotten, ...rest } = state.projects;
          return { projects: rest };
        }),
    }),
    { name: "composer-guide", version: 1 },
  ),
);

// -- Exports ------------------------------------------------------------------

export type { ProjectGuideFacts };
export { NO_PROJECT_FACTS, useGuideStore };
