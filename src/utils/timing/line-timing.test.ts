import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
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
