import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useTimelineDnd } from "@/views/timeline/use-timeline-dnd";
import { makeAltDuplicateEvent } from "@/views/timeline/use-timeline-dnd.test-helpers";

describe("useTimelineDnd · alt-drag duplicate", () => {
  beforeEach(() => {
    useAudioStore.setState({ duration: 30 });
    useTimelineStore.setState({ zoom: 100 });
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "Hello world",
          agentId: "v1",
          words: [
            { id: "w1", text: "Hello", sep: " ", begin: 0, end: 0.5 },
            { id: "w2", text: "world", sep: "", begin: 2, end: 2.5 },
          ],
        },
      ],
    });
  });

  it("keeps a word boundary when a duplicated last word lands before the original", async () => {
    const lines = useProjectStore.getState().lines;
    const { result } = await renderHook(() => useTimelineDnd(lines));

    result.current.handleDragEnd(makeAltDuplicateEvent(1, -100));

    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words.map((w) => w.text + w.sep)).toEqual(["Hello ", "world ", "world"]);
    const groups = computeSyllableGroups(words);
    expect(groups.some((g) => g.startIndex <= 1 && g.endIndex >= 2)).toBe(false);
  });
});
