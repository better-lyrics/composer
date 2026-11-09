// -- Types --------------------------------------------------------------------

type JourneyStepId = "song" | "lyrics" | "sync" | "fineTune" | "preview" | "export";

interface JourneyFacts {
  hasAudio: boolean;
  hasLyrics: boolean;
  syncComplete: boolean;
  visitedTimeline: boolean;
  visitedPreview: boolean;
  exported: boolean;
}

interface JourneyStep {
  id: JourneyStepId;
  done: boolean;
}

interface Journey {
  steps: JourneyStep[];
  current: JourneyStepId | null;
  doneCount: number;
}

// -- Derivations --------------------------------------------------------------

function projectJourney(facts: JourneyFacts): Journey {
  const steps: JourneyStep[] = [
    { id: "song", done: facts.hasAudio },
    { id: "lyrics", done: facts.hasLyrics },
    { id: "sync", done: facts.syncComplete },
    { id: "fineTune", done: facts.syncComplete && facts.visitedTimeline },
    { id: "preview", done: facts.visitedPreview },
    { id: "export", done: facts.exported },
  ];
  return {
    steps,
    current: steps.find((step) => !step.done)?.id ?? null,
    doneCount: steps.filter((step) => step.done).length,
  };
}

// -- Exports ------------------------------------------------------------------

export { projectJourney };
export type { Journey, JourneyStepId };
