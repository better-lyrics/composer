import { describe, expect, it } from "vitest";
import { type SubmitCheckInput, submitChecks, submitDurationSeconds } from "@/domain/unison/submit-checks";

// -- Fixtures ------------------------------------------------------------------

const CLEAN_TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:00.0" end="0:02.0">' +
  '<span begin="0:00.0" end="0:01.0">Hello</span> <span begin="0:01.0" end="0:02.0">world</span>' +
  "</p></div></body></tt>";

const PRETTY_TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:00.0" end="0:02.0">' +
  '<span begin="0:00.0" end="0:01.0">Hello</span>\n  <span begin="0:01.0" end="0:02.0">world</span>' +
  "</p></div></body></tt>";

function readyInput(overrides: Partial<SubmitCheckInput> = {}): SubmitCheckInput {
  return {
    mode: "new",
    videoId: "fJ9rUzIMcZQ",
    durationSeconds: 355.2,
    title: "Bohemian Rhapsody",
    artists: ["Queen"],
    syncedLineCount: 54,
    lineCount: 54,
    fullySynced: true,
    alignmentTier: "reviewed",
    content: CLEAN_TTML,
    contentIsEdited: false,
    isrc: "GBUM71029604",
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
    it("fails without a YouTube video", () => {
      expect(checkOf(readyInput({ videoId: undefined }), "video")).toMatchObject({
        status: "fail",
        problem: "no-video",
      });
    });

    it("fails without a known duration", () => {
      expect(checkOf(readyInput({ durationSeconds: 0 }), "video")).toMatchObject({
        status: "fail",
        problem: "no-duration",
      });
    });

    it("fails when the duration is outside what Unison accepts", () => {
      expect(checkOf(readyInput({ durationSeconds: 3601 }), "video")).toMatchObject({
        status: "fail",
        problem: "duration-out-of-range",
      });
    });
  });

  describe("song details", () => {
    it("fails without a title", () => {
      expect(checkOf(readyInput({ title: "  " }), "song")).toMatchObject({ status: "fail", problem: "no-title" });
    });

    it("fails when every artist is blank", () => {
      expect(checkOf(readyInput({ artists: ["", " "] }), "song")).toMatchObject({
        status: "fail",
        problem: "no-artist",
      });
    });
  });

  describe("sync", () => {
    it("fails when a line is not synced and carries the counts", () => {
      expect(checkOf(readyInput({ fullySynced: false, syncedLineCount: 50 }), "synced")).toMatchObject({
        status: "fail",
        syncedLineCount: 50,
        lineCount: 54,
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

    it("reports a generated export failure as not edited", () => {
      expect(checkOf(readyInput({ content: PRETTY_TTML }), "ttml")).toMatchObject({ status: "fail", edited: false });
    });
  });

  describe("ISRC", () => {
    it("is a note, never a failure, when missing", () => {
      const result = submitChecks(readyInput({ isrc: undefined }));
      expect(result.checks.find((check) => check.id === "isrc")?.status).toBe("note");
      expect(result.canSubmit).toBe(true);
    });

    it("treats a blank ISRC as missing", () => {
      expect(checkOf(readyInput({ isrc: "  " }), "isrc")?.status).toBe("note");
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
    it("canSubmit is false exactly when a check fails", () => {
      const inputs: SubmitCheckInput[] = [
        readyInput(),
        readyInput({ videoId: undefined }),
        readyInput({ title: "" }),
        readyInput({ fullySynced: false }),
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

describe("submitDurationSeconds", () => {
  it("rounds to whole seconds, as Unison stores them", () => {
    expect(submitDurationSeconds(355.6)).toBe(356);
  });
});
