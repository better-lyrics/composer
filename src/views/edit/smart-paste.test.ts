import { backupText, projectFileText } from "@/test/project-file-fixtures";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { classifyPastedText } from "@/views/edit/smart-paste";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000">Hello</p></div></body></tt>';
const LRC = "[00:01.00]Is this the real life\n[00:03.00]Is this just fantasy";
const SRT = "1\n00:00:02,000 --> 00:00:04,500\nFirst subtitle line\n\n2\n00:00:05,000 --> 00:00:07,000\nSecond line";

// -- Tests --------------------------------------------------------------------

describe("classifyPastedText", () => {
  it("reads every timed lyrics format as a lyrics file", () => {
    for (const text of [TTML, LRC, SRT, WANDERLUST_QRC]) expect(classifyPastedText(text)).toBe("lyrics-file");
  });

  it("reads a project file and a backup as project files", () => {
    expect(classifyPastedText(projectFileText())).toBe("project-file");
    expect(classifyPastedText(backupText(["One", "Two"]))).toBe("project-file");
  });

  it("keeps plain lyrics as typed text", () => {
    expect(classifyPastedText("Hello (ooh) world\nSecond line")).toBe("typed-text");
    expect(classifyPastedText("beau|ti|ful")).toBe("typed-text");
  });

  describe("edge cases", () => {
    it("treats a partial paste of a few LRC lines as a lyrics file", () => {
      expect(classifyPastedText("[01:12.30]Only this line\n[01:15.00]And this one")).toBe("lyrics-file");
    });

    it("keeps empty and whitespace pastes as text", () => {
      expect(classifyPastedText("")).toBe("typed-text");
      expect(classifyPastedText("   \n\t")).toBe("typed-text");
    });

    it("keeps section labels in brackets as text, since they carry no timestamp", () => {
      expect(classifyPastedText("[Chorus]\nLa la la")).toBe("typed-text");
    });

    it("keeps unicode lyrics as text", () => {
      expect(classifyPastedText("君の名は\n夜に駆ける")).toBe("typed-text");
    });
  });

  describe("ambiguous input stays text", () => {
    it("keeps lyrics that only mention a <tt tag as text", () => {
      expect(classifyPastedText("Type <tt> for teletype\nSecond line")).toBe("typed-text");
    });

    it("keeps JSON that is not a project as text", () => {
      expect(classifyPastedText('{"note": "not a project"}')).toBe("typed-text");
      expect(classifyPastedText("{ broken")).toBe("typed-text");
    });

    it("keeps a lone timestamp line with no lyric as text", () => {
      expect(classifyPastedText("[00:01.00]")).toBe("typed-text");
    });
  });
});
