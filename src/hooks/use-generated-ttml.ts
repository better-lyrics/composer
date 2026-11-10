import { useMemo } from "react";
import { projectAudioSource } from "@/audio/project-audio-source";
import { syncProgress } from "@/domain/line/sync-progress";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { getSplitCharacter } from "@/utils/split-character";
import { generateProjectTtml } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

type ProjectTtmlSource = Parameters<typeof generateProjectTtml>[0];

interface GeneratedTtmlInputs extends ProjectTtmlSource {
  duration: number;
  timing: TimingGranularity;
  youtubeVideoId: string | undefined;
  splitCharacter: string;
}

// -- State --------------------------------------------------------------------

let lastInputs: GeneratedTtmlInputs | null = null;
let lastContent = "";

// -- Functions ----------------------------------------------------------------

function sameInputs(a: GeneratedTtmlInputs, b: GeneratedTtmlInputs): boolean {
  return (
    a.metadata === b.metadata &&
    a.agents === b.agents &&
    a.lines === b.lines &&
    a.groups === b.groups &&
    a.duration === b.duration &&
    a.timing === b.timing &&
    a.youtubeVideoId === b.youtubeVideoId &&
    a.splitCharacter === b.splitCharacter
  );
}

// Every export consumer (Preview, Timeline preview, Export) asks for the same TTML, so it is built once per change.
function sharedGeneratedTtml(inputs: GeneratedTtmlInputs): string {
  if (lastInputs === null || !sameInputs(lastInputs, inputs)) {
    const { metadata, agents, lines, groups, duration, timing, youtubeVideoId } = inputs;
    lastContent = generateProjectTtml({ metadata, agents, lines, groups }, duration, timing, youtubeVideoId);
    lastInputs = inputs;
  }
  return lastContent;
}

// -- Hooks --------------------------------------------------------------------

function useGeneratedTtml(timing: TimingGranularity) {
  const metadata = useProjectStore((state) => state.metadata);
  const agents = useProjectStore((state) => state.agents);
  const lines = useProjectStore((state) => state.lines);
  const groups = useProjectStore((state) => state.groups);
  const duration = useAudioStore((state) => state.duration);
  const youtubeVideoId = useAudioStore((state) => {
    const audio = projectAudioSource(state);
    return audio?.kind === "youtube" ? audio.videoId : undefined;
  });

  const progress = useMemo(() => syncProgress(lines, "line"), [lines]);
  const content = sharedGeneratedTtml({
    metadata,
    agents,
    lines,
    groups,
    duration,
    timing,
    youtubeVideoId,
    splitCharacter: getSplitCharacter(),
  });

  return {
    content,
    duration,
    youtubeVideoId,
    lineCount: progress.total,
    syncedLineCount: progress.done,
    title: metadata.title,
  };
}

// -- Exports ------------------------------------------------------------------

export { useGeneratedTtml };
