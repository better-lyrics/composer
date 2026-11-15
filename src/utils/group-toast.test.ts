/**
 * @vitest-environment jsdom
 */

import { splitWord } from "insync/commands/word-structure";
import { lineFromFields } from "insync/line-from-fields";
import { mainTrack, timedSyllables } from "insync/line-track";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";
import { toast } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { showSplitInAllInstancesToast } from "@/utils/group-toast";

const chorusLine = (id: string, instanceIdx: number, begin: number) =>
  lineFromFields(
    {
      id,
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: ["I", "love", "you"].map((text, index) => ({
        id: `${id}-${index}`,
        text,
        sep: index < 2 ? " " : "",
        begin: begin + index * 0.3,
        end: begin + (index + 1) * 0.3,
        joinsNext: false,
      })),
    },
    DEFAULT_SPLIT_CHARACTER,
  );

const syllableTexts = () =>
  useProjectStore.getState().lines.map((line) => timedSyllables(mainTrack(line)).map((syllable) => syllable.text));

function clickUndoOnToastSince(baseline: number): void {
  const [shown] = toast.getHistory().slice(baseline);
  const action = shown && "action" in shown ? shown.action : undefined;
  if (!action || typeof action !== "object" || !("onClick" in action)) throw new Error("the notice offers no Undo");
  expect(action.label).toBe("Undo");
  Reflect.apply(action.onClick, undefined, []);
}

describe("group toasts", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
  });

  it("regression: Undo on the split in all instances notice restores every instance as it was before the split", () => {
    useProjectStore.setState({
      lines: [chorusLine("A", 0, 0), chorusLine("B", 1, 30)],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });
    const before = syllableTexts();
    const [first, love, last] = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    const split = [
      first,
      { ...love, id: "lo", text: "lo", sep: "", end: 0.45, joinsNext: true },
      { ...love, id: "ve", text: "ve", begin: 0.45 },
      last,
    ];
    useProjectStore.getState().commit(splitWord("A", "words", split, {}));
    expect(syllableTexts()).toEqual([
      ["I", "lo", "ve", "you"],
      ["I", "lo", "ve", "you"],
    ]);

    const baseline = toast.getHistory().length;
    showSplitInAllInstancesToast(2);
    clickUndoOnToastSince(baseline);

    expect(syllableTexts()).toEqual(before);
  });
});
