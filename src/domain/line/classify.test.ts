import type { LyricLine } from "@/stores/project";
import { describe, expect, it } from "vitest";
import { assertNever, classify, type LineClass } from "@/domain/line/classify";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LyricLine> = {}): LyricLine {
  return { id: "l1", text: "Hello", agentId: "v1", ...extras };
}

// -- classify -----------------------------------------------------------------

describe("classify", () => {
  it("returns 'word-synced' when words present", () => {
    expect(classify(line({ words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe("word-synced");
  });

  it("returns 'word-synced' even when line.begin/end also set (words win)", () => {
    expect(classify(line({ begin: 1, end: 2, words: [{ text: "Hi", begin: 1, end: 2 }] }))).toBe("word-synced");
  });

  it("returns 'line-synced' when only begin and end set", () => {
    expect(classify(line({ begin: 1, end: 2 }))).toBe("line-synced");
  });

  it("returns 'untimed' when no timing at all", () => {
    expect(classify(line())).toBe("untimed");
  });

  it("returns 'untimed' when only begin (incomplete)", () => {
    expect(classify(line({ begin: 1 }))).toBe("untimed");
  });

  it("returns 'untimed' when only bg words (no main timing)", () => {
    expect(classify(line({ backgroundWords: [{ text: "ah", begin: 1, end: 2 }] }))).toBe("untimed");
  });
});

// -- assertNever --------------------------------------------------------------

describe("assertNever", () => {
  it("throws on unexpected value", () => {
    expect(() => assertNever("unexpected" as never)).toThrow();
  });

  it("supports exhaustive switch idiom over LineClass", () => {
    function describeKind(kind: LineClass): string {
      switch (kind) {
        case "line-synced":
          return "line";
        case "word-synced":
          return "word";
        case "untimed":
          return "none";
        default:
          return assertNever(kind);
      }
    }
    expect(describeKind("line-synced")).toBe("line");
    expect(describeKind("word-synced")).toBe("word");
    expect(describeKind("untimed")).toBe("none");
  });
});
