import { describe, expect, it } from "vitest";
import type { SyllableAddress } from "@/domain/selection/model";
import { chainedNext, nextInQueue, queueOrder } from "@/domain/step-timing/step-queue";
import { createLine } from "@/test/factories";

const main = (lineId: string, _lineIndex: number, wordIndex: number): SyllableAddress => ({
  lineId,
  type: "word",
  syllableId: `${lineId}-word-${wordIndex}`,
});
const echo = (lineId: string, _lineIndex: number, wordIndex: number): SyllableAddress => ({
  lineId,
  type: "bg",
  syllableId: `${lineId}-bg-${wordIndex}`,
});
const lines = [
  createLine({
    id: "a",
    text: "Turn the page",
    words: ["Turn", "the", "page"].map((text, index) => ({
      id: `a-word-${index}`,
      text,
      begin: index,
      end: index + 1,
    })),
    backgroundText: "oh oh",
    backgroundWords: ["oh", "oh"].map((text, index) => ({ id: `a-bg-${index}`, text, begin: index, end: index + 1 })),
  }),
  createLine({ id: "b", text: "Again", words: [{ id: "b-word-0", text: "Again", begin: 4, end: 5 }] }),
];

describe("queueOrder", () => {
  it("orders by line, main before background, then word, whatever order the words were picked in", () => {
    const picked = [echo("a", 0, 1), main("b", 1, 0), echo("a", 0, 0), main("a", 0, 2), main("a", 0, 2)];
    expect(queueOrder(lines, picked)).toEqual([main("a", 0, 2), echo("a", 0, 0), echo("a", 0, 1), main("b", 1, 0)]);
  });
});

describe("nextInQueue", () => {
  const queue = [main("a", 0, 0), main("a", 0, 1), echo("a", 0, 0)];

  it("moves to the queue word after the cursor and ends after the last one", () => {
    expect(nextInQueue(queue, main("a", 0, 1))).toEqual(echo("a", 0, 0));
    expect(nextInQueue(queue, echo("a", 0, 0))).toBeNull();
  });
});

describe("chainedNext", () => {
  it("chains to the next word of the same track and from a line's last main word to the next line", () => {
    expect(chainedNext(main("a", 0, 0), main("a", 0, 1), main("a", 0, 1))).toEqual(main("a", 0, 1));
    expect(chainedNext(main("a", 0, 2), main("b", 1, 0), main("b", 1, 0))).toEqual(main("b", 1, 0));
  });

  it("does not chain across a gap in the queue or out of a background track", () => {
    expect(chainedNext(main("a", 0, 0), main("a", 0, 3), main("a", 0, 1))).toBeNull();
    expect(chainedNext(echo("a", 0, 1), main("b", 1, 0), main("b", 1, 0))).toBeNull();
    expect(chainedNext(main("a", 0, 2), echo("a", 0, 0), main("b", 1, 0))).toBeNull();
  });
});
