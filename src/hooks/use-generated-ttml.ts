import { syncProgress } from "@/domain/line/sync-progress";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import { projectAudioSource } from "@/lib/project-snapshot";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { generateProjectTtml } from "@/utils/ttml";
import { useMemo } from "react";

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
  const content = useMemo(
    () => generateProjectTtml({ metadata, agents, lines, groups }, duration, timing, youtubeVideoId),
    [metadata, agents, lines, groups, duration, timing, youtubeVideoId],
  );

  return {
    content,
    duration,
    youtubeVideoId,
    lineCount: progress.total,
    syncedLineCount: progress.done,
    title: metadata.title,
  };
}

export { useGeneratedTtml };
