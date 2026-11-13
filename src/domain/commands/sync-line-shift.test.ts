import { describe, expect, it } from "vitest";
import { shiftSyncLine } from "@/domain/commands/sync";
import { fieldsOfLine } from "@/domain/line/line-from-fields";
import { lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";

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

function seedWordSyncedLine(): void {
  useProjectStore.setState({
    lines: [
      createLine({
        id: "l1",
        text: "Hello world",
        words: [
          { text: "Hello", sep: " ", begin: 1, end: 1.5 },
          { text: "world", begin: 1.5, end: 2 },
        ],
      }),
    ],
  });
}

const store = () => useProjectStore.getState();
const lineAt = (index: number) => store().lines[index];

describe("nudgeLineBegin", () => {
  it("regression: moves the background words by the same delta as the line", () => {
    seedLine(10, 12);

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 0.5 }, Number.POSITIVE_INFINITY));

    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 10.5, end: 12.5 });
    expect(timedSyllables(backgroundTrack(lineAt(0)))).toEqual([
      { text: "ooh", sep: "", begin: 10.75, end: 11.25, joinsNext: false },
    ]);
  });

  it("regression: moves every word of a word-synced line", () => {
    seedWordSyncedLine();

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 0.5 }, Number.POSITIVE_INFINITY));

    expect(timedSyllables(mainTrack(lineAt(0)))).toMatchObject([
      { text: "Hello", sep: " ", begin: 1.5, end: 2, joinsNext: false },
      { text: "world", sep: "", begin: 2, end: 2.5, joinsNext: false },
    ]);
  });

  it("regression: keeps the untimed words of a partly timed line", () => {
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "Hello world", words: [{ text: "Hello", sep: " ", begin: 1, end: 1.5 }] })],
    });

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 0.5 }, Number.POSITIVE_INFINITY));

    expect(lineText(lineAt(0))).toBe("Hello world");
    expect(timedSyllables(mainTrack(lineAt(0)))).toMatchObject([
      { text: "Hello", sep: " ", begin: 1.5, end: 2, joinsNext: false },
    ]);
  });

  describe("edge cases", () => {
    it("stops at zero as a whole, keeping the line duration and its background offset", () => {
      seedLine(0.5, 2);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: -1 }, Number.POSITIVE_INFINITY));

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 0, end: 1.5 });
      expect(timedSyllables(backgroundTrack(lineAt(0)))).toEqual([
        { text: "ooh", sep: "", begin: 0.25, end: 0.75, joinsNext: false },
      ]);
    });

    it("leaves an untimed line alone", () => {
      seedLine(10, 12);
      const before = store().lines;

      useProjectStore.getState().commit(shiftSyncLine(before[1].id, { by: 0.5 }, Number.POSITIVE_INFINITY));

      expect(store().lines).toBe(before);
    });
  });

  describe("invariants", () => {
    it("is one undo step", () => {
      seedLine(10, 12);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 0.5 }, Number.POSITIVE_INFINITY));
      store().undo();

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 10, end: 12 });
      expect(timedSyllables(backgroundTrack(lineAt(0)))).toEqual([
        { text: "ooh", sep: "", begin: 10.25, end: 10.75, joinsNext: false },
      ]);
    });
  });
});

describe("setLineBegin", () => {
  it("regression: moves the background words with the line to its new start", () => {
    seedLine(10, 12);

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { to: 20 }, Number.POSITIVE_INFINITY));

    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 20, end: 22 });
    expect(timedSyllables(backgroundTrack(lineAt(0)))).toEqual([
      { text: "ooh", sep: "", begin: 20.25, end: 20.75, joinsNext: false },
    ]);
  });

  it("regression: sets the start of a word-synced line", () => {
    seedWordSyncedLine();

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { to: 3 }, Number.POSITIVE_INFINITY));

    expect(timedSyllables(mainTrack(lineAt(0)))).toMatchObject([
      { text: "Hello", sep: " ", begin: 3, end: 3.5, joinsNext: false },
      { text: "world", sep: "", begin: 3.5, end: 4, joinsNext: false },
    ]);
  });

  describe("edge cases", () => {
    it("clamps a negative start at zero and keeps the duration", () => {
      seedLine(10, 12);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { to: -1 }, Number.POSITIVE_INFINITY));

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 0, end: 2 });
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

    useProjectStore.getState().commit(shiftSyncLine(store().lines[1].id, { by: -5 }, Number.POSITIVE_INFINITY));

    expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 7, end: 9 });
    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 0, end: 2 });
  });

  it("stops a shared line set to a time before the range", () => {
    seedShared();

    useProjectStore.getState().commit(shiftSyncLine(store().lines[1].id, { to: 1 }, Number.POSITIVE_INFINITY));

    expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 7, end: 9 });
    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 0, end: 2 });
  });

  describe("regressions", () => {
    it("moves a line of an old group only to zero, as before", () => {
      useProjectStore.setState({
        lines: [sharedChorus("c0", 0, 3), sharedChorus("c1", 1, 10)],
        groups: [createGroup({ id: "g1" })],
      });

      useProjectStore.getState().commit(shiftSyncLine(store().lines[1].id, { by: -5 }, Number.POSITIVE_INFINITY));

      expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 5, end: 7 });
      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 3, end: 5 });
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

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 20 }, SONG_END));

    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 5, end: 7 });
    expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 12, end: 14 });
  });

  it("stops a shared line set past the range", () => {
    seedChorus(true);

    useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { to: 30 }, SONG_END));

    expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 5, end: 7 });
    expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 12, end: 14 });
  });

  describe("edge cases", () => {
    it.each([0, Number.NaN])("treats a song length of %s as no song end", (duration) => {
      seedChorus(true);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 20 }, duration));

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 23, end: 25 });
      expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 30, end: 32 });
    });
  });

  describe("regressions", () => {
    it("has no song end when no song length is given", () => {
      seedChorus(true);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 20 }, Number.POSITIVE_INFINITY));

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 23, end: 25 });
    });

    it("moves a line of an old group without touching its sibling", () => {
      seedChorus(false);

      useProjectStore.getState().commit(shiftSyncLine(store().lines[0].id, { by: 5 }, SONG_END));

      expect(fieldsOfLine(lineAt(0))).toMatchObject({ begin: 8, end: 10 });
      expect(fieldsOfLine(lineAt(1))).toMatchObject({ begin: 10, end: 12 });
    });
  });
});
