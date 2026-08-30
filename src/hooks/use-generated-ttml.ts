import { effectiveBounds } from "@/domain/line/bounds";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { generateTTML } from "@/utils/ttml";
import { useMemo } from "react";

function useGeneratedTtml() {
  const metadata = useProjectStore((state) => state.metadata);
  const agents = useProjectStore((state) => state.agents);
  const lines = useProjectStore((state) => state.lines);
  const groups = useProjectStore((state) => state.groups);
  const granularity = useProjectStore((state) => state.granularity);
  const duration = useAudioStore((state) => state.duration);

  const syncedLineCount = useMemo(() => {
    let count = 0;
    for (const line of lines) {
      if (effectiveBounds(line) !== null) count++;
    }
    return count;
  }, [lines]);
  const content = useMemo(
    () => (syncedLineCount > 0 ? generateTTML({ metadata, agents, lines, groups, granularity, duration }) : ""),
    [metadata, agents, lines, groups, granularity, duration, syncedLineCount],
  );

  return { content, duration, lineCount: lines.length, syncedLineCount, title: metadata.title };
}

export { useGeneratedTtml };
