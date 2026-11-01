import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { TimelineContextMenu } from "@/views/timeline/timeline-context-menu";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function seed(lines: LyricLine[], lineId: string, wordIndex: number, type: "word" | "bg" = "word") {
  useProjectStore.setState({ groups: [], lines });
  useProjectStore.getState().clearHistory();
  const lineIndex = lines.findIndex((line) => line.id === lineId);
  useTimelineStore.setState({
    contextMenu: { x: 100, y: 100, target: { kind: "word", lineId, lineIndex, wordIndex, type } },
    selectedWords: [],
  });
}

async function clickDelete(label = "Delete word") {
  const screen = await render(<TimelineContextMenu />);
  await screen.getByRole("menuitem", { name: label }).click();
  await expect.poll(() => useTimelineStore.getState().contextMenu).toBeNull();
}

const lineById = (id: string) => useProjectStore.getState().lines.find((line) => line.id === id);

// -- Tests --------------------------------------------------------------------

describe("TimelineContextMenu · delete word", () => {
  it("removes the clicked word from a word-synced line", async () => {
    seed(
      [
        createLine({
          id: "l1",
          text: "hello world",
          words: [
            { text: "hello ", begin: 1, end: 2 },
            { text: "world", begin: 2, end: 3 },
          ],
        }),
      ],
      "l1",
      0,
    );
    await clickDelete();

    expect(lineById("l1")?.words).toEqual([createWord({ text: "world", begin: 2, end: 3 })]);
  });

  it("removes the clicked background word", async () => {
    seed(
      [
        createLine({
          id: "l1",
          text: "hello",
          words: [{ text: "hello", begin: 1, end: 2 }],
          backgroundText: "ooh aah",
          backgroundWords: [
            { text: "ooh ", begin: 1, end: 1.5 },
            { text: "aah", begin: 1.5, end: 2 },
          ],
        }),
      ],
      "l1",
      1,
      "bg",
    );
    await clickDelete();

    expect(lineById("l1")?.backgroundWords?.map((word) => word.text.trim())).toEqual(["ooh"]);
    expect(lineById("l1")?.words).toHaveLength(1);
  });

  describe("regressions", () => {
    it("regression: removes the word from every linked instance", async () => {
      const chorus = (instanceIdx: number, begin: number) =>
        createLine({
          id: `c${instanceIdx}`,
          text: "go now",
          words: [
            { text: "go ", begin, end: begin + 1 },
            { text: "now", begin: begin + 1, end: begin + 2 },
          ],
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 0,
        });
      seed([chorus(0, 10), chorus(1, 40)], "c1", 0);
      useProjectStore.setState({ groups: [createGroup({ id: "g1", label: "Chorus" })] });
      await clickDelete();

      expect(lineById("c0")?.words?.map((word) => word.text)).toEqual(["now"]);
      expect(lineById("c1")?.words?.map((word) => word.text)).toEqual(["now"]);
    });

    it("regression: removes the timing of a line-synced line (issue #285)", async () => {
      seed([createLine({ id: "l1", text: "hello world", begin: 1, end: 3 })], "l1", 0);
      await clickDelete();

      const line = lineById("l1");
      expect(line && hasAnyTiming(line)).toBe(false);
      expect(line?.text).toBe("hello world");
    });

    const threeWords = () =>
      createLine({
        id: "l1",
        text: "one two three",
        words: [
          { text: "one ", begin: 1, end: 2 },
          { text: "two ", begin: 2, end: 3 },
          { text: "three", begin: 3, end: 4 },
        ],
      });

    it("regression: deletes the whole selection when the clicked word is in it", async () => {
      seed([threeWords()], "l1", 1);
      useTimelineStore.setState({
        selectedWords: [
          { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" },
          { lineId: "l1", lineIndex: 0, wordIndex: 1, type: "word" },
        ],
      });
      await clickDelete("Delete 2 words");

      expect(lineById("l1")?.words).toEqual([createWord({ text: "three", begin: 3, end: 4 })]);
      expect(useTimelineStore.getState().selectedWords).toEqual([]);
    });

    it("regression: deletes only the clicked word outside the selection and drops the stale selection", async () => {
      seed([threeWords()], "l1", 2);
      useTimelineStore.setState({
        selectedWords: [
          { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" },
          { lineId: "l1", lineIndex: 0, wordIndex: 1, type: "word" },
        ],
      });
      await clickDelete();

      expect(lineById("l1")?.words?.map((word) => word.text)).toEqual(["one ", "two "]);
      expect(useTimelineStore.getState().selectedWords).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("absorbs a deleted syllable into its neighbor", async () => {
      seed(
        [
          createLine({
            id: "l1",
            text: "hel|lo",
            words: [
              { text: "hel", begin: 1, end: 1.5, syllableGroupId: "s1" },
              { text: "lo", begin: 1.5, end: 2, syllableGroupId: "s1" },
            ],
          }),
        ],
        "l1",
        1,
      );
      await clickDelete("Delete syllable");

      expect(lineById("l1")?.words).toHaveLength(1);
      expect(lineById("l1")?.words?.[0]?.begin).toBe(1);
    });

    it("unlinks an instance once its last word is gone", async () => {
      const group = createGroup({ id: "g1", label: "Chorus" });
      seed(
        [
          createLine({
            id: "c0",
            text: "go",
            words: [{ text: "go", begin: 10, end: 11 }],
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
          }),
          createLine({
            id: "c1",
            text: "go",
            words: [{ text: "go", begin: 40, end: 41 }],
            groupId: "g1",
            instanceIdx: 1,
            templateLineIdx: 0,
          }),
        ],
        "c1",
        0,
      );
      useProjectStore.setState({ groups: [group] });
      await clickDelete();

      const c1 = lineById("c1");
      expect(c1 && isLinked(c1)).toBe(false);
      const c0 = lineById("c0");
      expect(c0 && isLinked(c0)).toBe(true);
    });
  });

  describe("invariants", () => {
    it("is one undo step", async () => {
      const line = createLine({ id: "l1", text: "hello world", begin: 1, end: 3 });
      seed([line], "l1", 0);
      await clickDelete();

      useProjectStore.getState().undo();

      expect(lineById("l1")).toEqual(line);
    });

    it("leaves other lines untouched", async () => {
      const other = createLine({ id: "l2", text: "bye", begin: 5, end: 6 });
      seed([createLine({ id: "l1", text: "hello", begin: 1, end: 3 }), other], "l1", 0);
      await clickDelete();

      expect(lineById("l2")).toBe(other);
    });
  });
});
