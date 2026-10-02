import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { nudgeLineBegin, setLineBegin } from "@/utils/timing/line-timing";

function seedLine(begin: number, end: number): void {
  useProjectStore.setState({
    lines: [
      createLine({
        id: "l1",
        text: "main",
        begin,
        end,
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: begin + 0.25, end: begin + 0.75 }],
      }),
      createLine({ id: "l2", text: "untimed" }),
    ],
  });
}

const store = () => useProjectStore.getState();
const lineAt = (index: number) => store().lines[index];

describe("nudgeLineBegin", () => {
  it("regression: moves the background words by the same delta as the line", () => {
    seedLine(10, 12);

    nudgeLineBegin(store().lines, 0, 0.5, store().updateLineWithHistory);

    expect(lineAt(0)).toMatchObject({ begin: 10.5, end: 12.5 });
    expect(lineAt(0).backgroundWords).toEqual([{ text: "ooh", begin: 10.75, end: 11.25 }]);
  });

  describe("edge cases", () => {
    it("stops at zero as a whole, keeping the line duration and its background offset", () => {
      seedLine(0.5, 2);

      nudgeLineBegin(store().lines, 0, -1, store().updateLineWithHistory);

      expect(lineAt(0)).toMatchObject({ begin: 0, end: 1.5 });
      expect(lineAt(0).backgroundWords).toEqual([{ text: "ooh", begin: 0.25, end: 0.75 }]);
    });

    it("leaves an untimed line alone", () => {
      seedLine(10, 12);
      const before = store().lines;

      nudgeLineBegin(before, 1, 0.5, store().updateLineWithHistory);

      expect(store().lines).toBe(before);
    });
  });

  describe("invariants", () => {
    it("is one undo step", () => {
      seedLine(10, 12);

      nudgeLineBegin(store().lines, 0, 0.5, store().updateLineWithHistory);
      store().undo();

      expect(lineAt(0)).toMatchObject({ begin: 10, end: 12 });
      expect(lineAt(0).backgroundWords).toEqual([{ text: "ooh", begin: 10.25, end: 10.75 }]);
    });
  });
});

describe("setLineBegin", () => {
  it("regression: moves the background words with the line to its new start", () => {
    seedLine(10, 12);

    setLineBegin(store().lines, 0, 20, store().updateLineWithHistory);

    expect(lineAt(0)).toMatchObject({ begin: 20, end: 22 });
    expect(lineAt(0).backgroundWords).toEqual([{ text: "ooh", begin: 20.25, end: 20.75 }]);
  });

  describe("edge cases", () => {
    it("clamps a negative start at zero and keeps the duration", () => {
      seedLine(10, 12);

      setLineBegin(store().lines, 0, -1, store().updateLineWithHistory);

      expect(lineAt(0)).toMatchObject({ begin: 0, end: 2 });
    });
  });
});

describe("shared timing", () => {
  const sharedChorus = (id: string, instanceIdx: number, begin: number) =>
    createLine({ id, text: "chorus", groupId: "g1", instanceIdx, templateLineIdx: 0, begin, end: begin + 2 });

  function seedShared(): void {
    useProjectStore.setState({
      lines: [sharedChorus("c0", 0, 3), sharedChorus("c1", 1, 10)],
      groups: [createGroup({ id: "g1", sharesTiming: true })],
    });
  }

  it("stops a shared line where the earliest instance reaches zero", () => {
    seedShared();

    nudgeLineBegin(store().lines, 1, -5, store().updateLineWithHistory, store().groups);

    expect(lineAt(1)).toMatchObject({ begin: 7, end: 9 });
    expect(lineAt(0)).toMatchObject({ begin: 0, end: 2 });
  });

  it("stops a shared line set to a time before the range", () => {
    seedShared();

    setLineBegin(store().lines, 1, 1, store().updateLineWithHistory, store().groups);

    expect(lineAt(1)).toMatchObject({ begin: 7, end: 9 });
    expect(lineAt(0)).toMatchObject({ begin: 0, end: 2 });
  });

  describe("regressions", () => {
    it("moves a line of an old group only to zero, as before", () => {
      useProjectStore.setState({
        lines: [sharedChorus("c0", 0, 3), sharedChorus("c1", 1, 10)],
        groups: [createGroup({ id: "g1" })],
      });

      nudgeLineBegin(store().lines, 1, -5, store().updateLineWithHistory, store().groups);

      expect(lineAt(1)).toMatchObject({ begin: 5, end: 7 });
      expect(lineAt(0)).toMatchObject({ begin: 3, end: 5 });
    });
  });
});

describe("song end", () => {
  const SONG_END = 14;
  const chorus = (id: string, instanceIdx: number, begin: number) =>
    createLine({ id, text: "chorus", groupId: "g1", instanceIdx, templateLineIdx: 0, begin, end: begin + 2 });

  function seedChorus(sharesTiming: boolean): void {
    useProjectStore.setState({
      lines: [chorus("c0", 0, 3), chorus("c1", 1, 10)],
      groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
    });
  }

  it("stops a shared line where the latest instance reaches the song end", () => {
    seedChorus(true);

    nudgeLineBegin(store().lines, 0, 20, store().updateLineWithHistory, store().groups, SONG_END);

    expect(lineAt(0)).toMatchObject({ begin: 5, end: 7 });
    expect(lineAt(1)).toMatchObject({ begin: 12, end: 14 });
  });

  it("stops a shared line set past the range", () => {
    seedChorus(true);

    setLineBegin(store().lines, 0, 30, store().updateLineWithHistory, store().groups, SONG_END);

    expect(lineAt(0)).toMatchObject({ begin: 5, end: 7 });
    expect(lineAt(1)).toMatchObject({ begin: 12, end: 14 });
  });

  describe("edge cases", () => {
    it.each([0, Number.NaN])("treats a song length of %s as no song end", (duration) => {
      seedChorus(true);

      nudgeLineBegin(store().lines, 0, 20, store().updateLineWithHistory, store().groups, duration);

      expect(lineAt(0)).toMatchObject({ begin: 23, end: 25 });
      expect(lineAt(1)).toMatchObject({ begin: 30, end: 32 });
    });
  });

  describe("regressions", () => {
    it("has no song end when no song length is given", () => {
      seedChorus(true);

      nudgeLineBegin(store().lines, 0, 20, store().updateLineWithHistory, store().groups);

      expect(lineAt(0)).toMatchObject({ begin: 23, end: 25 });
    });

    it("moves a line of an old group without touching its sibling", () => {
      seedChorus(false);

      nudgeLineBegin(store().lines, 0, 5, store().updateLineWithHistory, store().groups, SONG_END);

      expect(lineAt(0)).toMatchObject({ begin: 8, end: 10 });
      expect(lineAt(1)).toMatchObject({ begin: 10, end: 12 });
    });
  });
});
