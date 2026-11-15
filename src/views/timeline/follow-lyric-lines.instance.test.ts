import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { splitWord } from "@/domain/commands/word-structure";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { wordAt } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { resetAllStores } from "@/test/stores";
import { followLyricLines } from "@/views/timeline/follow-lyric-lines";
import { useTimelineStore } from "@/views/timeline/timeline-store";

const chorusLine = (instanceIdx: number, begin: number) =>
  createLine({
    id: `glow-${instanceIdx}`,
    text: "We glow tonight",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { text: "We", sep: " ", begin, end: begin + 0.4 },
      { text: "glow", sep: " ", begin: begin + 0.4, end: begin + 1 },
      { text: "tonight", begin: begin + 1, end: begin + 1.6 },
    ],
  });

describe("selection after a template edit", () => {
  let stopFollowing = () => {};

  beforeEach(async () => {
    await resetAllStores();
    useProjectStore.getState().restoreLyrics({
      lines: [chorusLine(0, 10), chorusLine(1, 40), chorusLine(2, 70)],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1, sharesTiming: true }],
    });
    stopFollowing = followLyricLines();
  });

  afterEach(() => stopFollowing());

  it("undo of a split in one instance keeps the selection in that instance", () => {
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[1]));
    const tonight = { lineId: "glow-1", type: "word" as const, syllableId: words[2].id };
    useTimelineStore.getState().setSelectedWords([tonight]);
    const glow = words[1];
    const split = words.toSpliced(
      1,
      1,
      { ...glow, text: "gl", sep: "", end: glow.begin + 0.2, joinsNext: true },
      { ...glow, id: "glow-tail", text: "ow", begin: glow.begin + 0.2 },
    );

    useProjectStore.getState().commit(splitWord("glow-1", "words", split, {}));
    expect(useProjectStore.getState().lines.map((line) => timedSyllables(mainTrack(line)).length)).toEqual([4, 4, 4]);
    useProjectStore.getState().undo();

    const { lines } = useProjectStore.getState();
    expect(useTimelineStore.getState().selectedWords).toEqual([tonight]);
    expect(wordAt(lines, tonight)?.text).toBe("tonight");
  });
});
