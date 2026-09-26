import { syncProgress } from "@/domain/line/sync-progress";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { generateTTML } from "@/utils/ttml";
import { useMemo } from "react";

function useGeneratedTtml() {
  const metadata = useProjectStore((state) => state.metadata);
  const agents = useProjectStore((state) => state.agents);
  const lines = useProjectStore((state) => state.lines);
  const groups = useProjectStore((state) => state.groups);
  const duration = useAudioStore((state) => state.duration);

  const progress = useMemo(() => syncProgress(lines, "line"), [lines]);
  const content = useMemo(
    () => (progress.done > 0 ? generateTTML({ metadata, agents, lines, groups, duration }) : ""),
    [metadata, agents, lines, groups, duration, progress.done],
  );

  return { content, duration, lineCount: progress.total, syncedLineCount: progress.done, title: metadata.title };
}

export { useGeneratedTtml };
