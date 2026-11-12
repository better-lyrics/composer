import { describe, expect, it } from "vitest";
import { type SubmitCheckInput, submitChecks } from "@/domain/unison/submit-checks";
import { createLine } from "@/test/factories";

// -- Fixtures ------------------------------------------------------------------

const CLEAN_TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:00.0" end="0:02.0">' +
  '<span begin="0:00.0" end="0:01.0">Hello</span> <span begin="0:01.0" end="0:02.0">world</span>' +
  "</p></div></body></tt>";

const PRETTY_TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:00.0" end="0:02.0">' +
  '<span begin="0:00.0" end="0:01.0">Hello</span>\n  <span begin="0:01.0" end="0:02.0">world</span>' +
  "</p></div></body></tt>";

const ZERO_LENGTH_TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:01.0" end="0:02.0">' +
  '<span begin="0:01.0" end="0:01.0">ka</span><span begin="0:01.0" end="0:02.0">mu</span>' +
  "</p></div></body></tt>";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

const SYNCED_LINES = [
  createLine({ text: "aku sayang", words: [word("aku ", 1, 2), word("sayang", 2, 3)] }),
  createLine({ text: "kamu", words: [word("kamu", 3, 4)] }),
];

function readyInput(overrides: Partial<SubmitCheckInput> = {}): SubmitCheckInput {
  return {
    mode: "new",
    videoId: "fJ9rUzIMcZQ",
    durationSeconds: 355.2,
    title: "Bohemian Rhapsody",
    artists: ["Queen"],
    lines: SYNCED_LINES,
    alignmentTier: "reviewed",
    content: CLEAN_TTML,
    contentIsEdited: false,
    isrc: "GBUM71029604",
    language: undefined,
    ...overrides,
  };
}

function checkOf(input: SubmitCheckInput, id: string) {
  return submitChecks(input).checks.find((check) => check.id === id);
}

// -- Tests ---------------------------------------------------------------------

describe("submitChecks", () => {
  it("passes every check for a ready project", () => {
    const result = submitChecks(readyInput());
    expect(result.canSubmit).toBe(true);
    expect(result.checks.map((check) => [check.id, check.status])).toEqual([
      ["video", "pass"],
      ["song", "pass"],
      ["synced", "pass"],
      ["alignment", "pass"],
      ["ttml", "pass"],
      ["isrc", "pass"],
    ]);
  });

  describe("matched video", () => {
    it("fails when the duration is outside what Unison accepts", () => {
      expect(checkOf(readyInput({ durationSeconds: 3601 }), "video")).toMatchObject({
        status: "fail",
        problem: "duration-out-of-range",
      });
    });
  });

  describe("song details", () => {
    it("fails when every artist is blank", () => {
      expect(checkOf(readyInput({ artists: ["", " "] }), "song")).toMatchObject({
        status: "fail",
        problem: "no-artist",
      });
    });
  });

  describe("synced lines", () => {
    it("regression: the synced count follows the pass rule", () => {
      const merged = createLine({
        text: "pada hal ke|cil",
        words: [word("pada ", 5, 6), word("hal ke", 6, 7), word("cil", 7, 8)],
      });
      expect(checkOf(readyInput({ lines: [...SYNCED_LINES, merged] }), "synced")).toMatchObject({
        status: "fail",
        syncedLineCount: 2,
        lineCount: 3,
        fix: { kind: "lines", issues: [{ lineId: merged.id, lineIndex: 2, track: "main", problemSlots: [1, 2] }] },
      });
    });
  });

  describe("auto-align review", () => {
    it("blocks untouched auto-align output", () => {
      const result = submitChecks(readyInput({ alignmentTier: "untouched" }));
      expect(result.checks.find((check) => check.id === "alignment")?.status).toBe("fail");
      expect(result.canSubmit).toBe(false);
    });

    it("does not block mostly untouched output", () => {
      const result = submitChecks(readyInput({ alignmentTier: "mostly-untouched" }));
      expect(result.checks.find((check) => check.id === "alignment")?.status).toBe("pass");
      expect(result.canSubmit).toBe(true);
    });
  });

  describe("TTML pre-check", () => {
    it("fails edited TTML that Unison rejects and says the edit is the cause", () => {
      expect(checkOf(readyInput({ content: PRETTY_TTML, contentIsEdited: true }), "ttml")).toMatchObject({
        status: "fail",
        problem: "line-breaks",
        edited: true,
      });
    });
  });

  describe("generated TTML with zero-length words", () => {
    it("lists every track that has a word with no length", () => {
      const line = createLine({
        text: "ka|mu",
        words: [word("ka", 1, 1), word("mu", 1, 2)],
        backgroundText: "(ooh yeah)",
        backgroundWords: [word("(ooh ", 1, 1.5), word("yeah)", 1.5, 1.5)],
      });
      expect(checkOf(readyInput({ lines: [line], content: ZERO_LENGTH_TTML }), "ttml")).toMatchObject({
        status: "fail",
        problem: "zero-length-words",
        fix: {
          kind: "lines",
          issues: [
            { lineId: line.id, lineIndex: 0, track: "main", kind: "zero-length", count: 1, problemSlots: [0] },
            { lineId: line.id, lineIndex: 0, track: "background", kind: "zero-length", count: 1, problemSlots: [1] },
          ],
        },
      });
    });
  });

  describe("ISRC", () => {
    it("is a note, never a failure, when missing", () => {
      const result = submitChecks(readyInput({ isrc: undefined }));
      expect(result.checks.find((check) => check.id === "isrc")?.status).toBe("note");
      expect(result.canSubmit).toBe(true);
    });
  });

  describe("update mode", () => {
    it("leaves out the video and song checks a revision never sends", () => {
      const result = submitChecks(readyInput({ mode: "update", videoId: undefined, title: "" }));
      expect(result.checks.map((check) => check.id)).toEqual(["synced", "alignment", "ttml", "isrc"]);
      expect(result.canSubmit).toBe(true);
    });

    it("still blocks untouched auto-align output", () => {
      expect(submitChecks(readyInput({ mode: "update", alignmentTier: "untouched" })).canSubmit).toBe(false);
    });
  });

  describe("invariants", () => {
    it("every failed check carries a fix", () => {
      const broken = readyInput({
        videoId: undefined,
        title: "",
        lines: [...SYNCED_LINES, createLine({ text: "aku sayang" })],
        alignmentTier: "untouched",
        content: PRETTY_TTML,
        isrc: "not-an-isrc",
        language: "xx_yy",
      });
      const failed = submitChecks(broken).checks.filter((check) => check.status === "fail");
      for (const check of failed) expect(check.fix).toBeDefined();
      expect(failed).toHaveLength(7);
    });

    it("canSubmit is false exactly when a check fails", () => {
      const inputs: SubmitCheckInput[] = [
        readyInput(),
        readyInput({ videoId: undefined }),
        readyInput({ title: "" }),
        readyInput({ lines: [createLine({ text: "aku sayang" })] }),
        readyInput({ alignmentTier: "untouched" }),
        readyInput({ alignmentTier: "mostly-untouched", isrc: undefined }),
        readyInput({ content: PRETTY_TTML, contentIsEdited: true }),
        readyInput({ isrc: undefined }),
      ];
      for (const input of inputs) {
        const result = submitChecks(input);
        expect(result.canSubmit).toBe(!result.checks.some((check) => check.status === "fail"));
      }
    });
  });
});
