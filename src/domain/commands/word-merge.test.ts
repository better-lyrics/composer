/**
 * @vitest-environment node
 */

import { pasteLyrics } from "@/domain/commands/edit-text";
import { mergeWords } from "@/domain/commands/word-merge";
import { deleteWords } from "@/domain/commands/word-structure";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const still = createWord({ text: "still ", begin: 1, end: 1.4 });
const water = createWord({ text: "water", begin: 1.5, end: 2 });
const run = [addressOf({ id: "l1" }, "word", still), addressOf({ id: "l1" }, "word", water)];

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore
    .getState()
    .commit(
      pasteLyrics(useProjectStore.getState().lines, [
        createLine({ id: "l1", text: "still water", words: [still, water] }),
      ]),
    );
});

describe("word merge command", () => {
  it("refuses a run whose words are gone and leaves history alone", () => {
    useProjectStore.getState().commit(deleteWords([run[1]]));
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(mergeWords(run));
    expect(outcome).toEqual({ refused: { reason: "word-gone", address: run[0] } });
    expect(useProjectStore.getState().history).toBe(before);
  });

  it("a merge in one instance reaches a copy split differently, where its letters sit in that copy", () => {
    const group = createGroup({ id: "chorus" });
    const link = { groupId: group.id, templateLineIdx: 0 };
    const source = createLine({
      ...link,
      id: "l1",
      instanceIdx: 0,
      text: "still water runs",
      words: [still, water, createWord({ text: "runs", begin: 2.1, end: 2.6 })],
    });
    const differentlySplit = createLine({
      ...link,
      id: "l2",
      instanceIdx: 1,
      text: "still water runs",
      words: ["still ", "wa", "ter runs"].map((text, index) =>
        createWord({ text, begin: 9 + index, end: 9.8 + index }),
      ),
    });
    useProjectStore.setState({ lines: [source, differentlySplit], groups: [group] });

    useProjectStore.getState().commit(mergeWords(run));

    const [merged, copy] = useProjectStore.getState().lines;
    const spans = copy.tracks[0].syllables.map((syllable) => [syllable.begin, syllable.end]);
    expect(copy.tracks[0].syllables.map((syllable) => syllable.text)).toEqual(
      merged.tracks[0].syllables.map((syllable) => syllable.text),
    );
    expect(spans).toEqual([
      [9, 11.342857143],
      [11.342857143, 11.8],
    ]);
  });
});
