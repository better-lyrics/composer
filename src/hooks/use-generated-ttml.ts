import { useMemo } from "react";
import { projectAudioSource } from "@/audio/project-audio-source";
import { syncProgress } from "insync/line-sync-progress";
import type { TimingGranularity } from "insync/project-timing-granularity";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { generateProjectTtml } from "insync/ttml/write";
import { getSplitCharacter } from "@/utils/split-character";

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
    a.parts === b.parts &&
    a.passthrough === b.passthrough &&
    a.duration === b.duration &&
    a.timing === b.timing &&
    a.youtubeVideoId === b.youtubeVideoId &&
    a.splitCharacter === b.splitCharacter
  );
}

// Every export consumer (Preview, Timeline preview, Export) asks for the same TTML, so it is built once per change.
function sharedGeneratedTtml(inputs: GeneratedTtmlInputs): string {
  if (lastInputs === null || !sameInputs(lastInputs, inputs)) {
    const { metadata, agents, lines, groups, parts, passthrough, duration, timing, youtubeVideoId } = inputs;
    lastContent = generateProjectTtml(
      { metadata, agents, lines, groups, parts, passthrough },
      duration,
      getSplitCharacter(),
      timing,
      youtubeVideoId,
    );
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
  const parts = useProjectStore((state) => state.parts);
  const passthrough = useProjectStore((state) => state.passthrough);
  const duration = useAudioStore((state) => state.duration);
  const youtubeVideoId = useAudioStore((state) => {
    const audio = projectAudioSource(state);
    return audio?.kind === "youtube" ? audio.videoId : undefined;
  });
  const splitCharacter = useSettingsStore((state) => state.splitCharacter);

  const progress = useMemo(() => syncProgress(lines, "line", getSplitCharacter()), [lines]);
  const content = sharedGeneratedTtml({
    metadata,
    agents,
    lines,
    groups,
    parts,
    passthrough,
    duration,
    timing,
    youtubeVideoId,
    splitCharacter,
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
