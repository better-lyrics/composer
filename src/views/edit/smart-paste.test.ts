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
    for (const text of [TTML, LRC, SRT, WANDERLUST_QRC]) expect(classifyPastedText(text).kind).toBe("lyrics-file");
  });

  it("reads a project file and a backup as project files", () => {
    expect(classifyPastedText(projectFileText()).kind).toBe("project-file");
    expect(classifyPastedText(backupText(["One", "Two"])).kind).toBe("project-file");
  });

  it("keeps plain lyrics as typed text", () => {
    expect(classifyPastedText("Hello (ooh) world\nSecond line").kind).toBe("typed-text");
    expect(classifyPastedText("beau|ti|ful").kind).toBe("typed-text");
  });

  describe("edge cases", () => {
    it("treats a partial paste of a few LRC lines as a lyrics file", () => {
      expect(classifyPastedText("[01:12.30]Only this line\n[01:15.00]And this one").kind).toBe("lyrics-file");
    });

    it("keeps empty and whitespace pastes as text", () => {
      expect(classifyPastedText("").kind).toBe("typed-text");
      expect(classifyPastedText("   \n\t").kind).toBe("typed-text");
    });

    it("keeps section labels in brackets as text, since they carry no timestamp", () => {
      expect(classifyPastedText("[Chorus]\nLa la la").kind).toBe("typed-text");
    });

    it("keeps unicode lyrics as text", () => {
      expect(classifyPastedText("君の名は\n夜に駆ける").kind).toBe("typed-text");
    });
  });

  describe("whole files only", () => {
    it("hands back the parsed lyrics so the import does not parse them again", () => {
      const pasted = classifyPastedText(LRC);
      expect(pasted.kind === "lyrics-file" && pasted.parsed.lines.map((line) => line.text)).toEqual([
        "Is this the real life",
        "Is this just fantasy",
      ]);
    });

    it("hands back the parsed project file", () => {
      const pasted = classifyPastedText(projectFileText());
      expect(pasted.kind === "project-file" && pasted.contents.kind).toBe("project");
    });

    it("reads an SRT that opens with blank lines or a byte order mark", () => {
      expect(classifyPastedText(`\n\n${SRT}`).kind).toBe("lyrics-file");
      expect(classifyPastedText(`\uFEFF${SRT}`).kind).toBe("lyrics-file");
    });

    it("reads a project file that opens with a byte order mark", () => {
      expect(classifyPastedText(`\uFEFF${projectFileText()}`).kind).toBe("project-file");
    });

    it("reads a TTML document that opens with an XML declaration", () => {
      expect(classifyPastedText(`<?xml version="1.0" encoding="utf-8"?>\n${TTML}`).kind).toBe("lyrics-file");
    });
  });

  describe("regressions", () => {
    it("regression: keeps lyrics with a bracketed number pair mid-line as text, not QRC", () => {
      expect(classifyPastedText("Verse [1,2] repeated twice\nAnd again").kind).toBe("typed-text");
    });

    it("regression: keeps a line that opens with a number pair but has no QRC word timing as text", () => {
      expect(classifyPastedText("[12,34] what").kind).toBe("typed-text");
    });

    it("regression: keeps prose that quotes a TTML tag mid-sentence as text", () => {
      expect(classifyPastedText('I wrote <tt xmlns="x"><p>hi</p></tt> in my notes').kind).toBe("typed-text");
    });
  });

  describe("real LRC files with a preamble", () => {
    it("reads an LRC with a bare title line as a lyrics file", () => {
      const result = classifyPastedText(
        "JHENRY\n\n[00:09.49]Say, John Henry what ya doing it for?\n[00:13.04]Showed you progress and you're calling it war\n[00:16.29]My, my",
      );
      expect(result.kind).toBe("lyrics-file");
      if (result.kind === "lyrics-file") expect(result.parsed.lines).toHaveLength(3);
    });

    it("reads an exported LRC with a header and a plain lyrics block, keeping only the synced lines", () => {
      const result = classifyPastedText(
        "Track Name: ZHIEND - Scar on Face (English)\nArtist Name: MarcusTheRocker\n\nPlain Lyrics:\n劣性\n前髪が\n\nSynced Lyrics:\n[00:32.50] 劣性\n[00:35.86] 前髪が\n[00:39.69] 劣性",
      );
      expect(result.kind).toBe("lyrics-file");
    });

    it("keeps an LRC saved as rich text as text, since its lines carry RTF control words", () => {
      const rtf =
        "{\\rtf1\\ansi\\ansicpg1252\\cocoartf2867\n\\f0\\fs24 \\cf0 [00:09.49]Say, John Henry\\\n[00:13.04]Showed you progress\\\n[00:16.29]My, my\\\n[00:24.77]Twelve long hours\\\n[00:27.98]Nine pound hammer\\\n}";
      expect(classifyPastedText(rtf).kind).toBe("typed-text");
    });

    it("keeps prose with one stray timestamp as text", () => {
      expect(
        classifyPastedText("We met at eight.\n[00:12.34] is where the chorus kicks in.\nThe crowd was great.").kind,
      ).toBe("typed-text");
    });
  });

  describe("ambiguous input stays text", () => {
    it("keeps lyrics that only mention a <tt tag as text", () => {
      expect(classifyPastedText("Type <tt> for teletype\nSecond line").kind).toBe("typed-text");
    });

    it("keeps JSON that is not a project as text", () => {
      expect(classifyPastedText('{"note": "not a project"}').kind).toBe("typed-text");
      expect(classifyPastedText("{ broken").kind).toBe("typed-text");
    });

    it("keeps a lone timestamp line with no lyric as text", () => {
      expect(classifyPastedText("[00:01.00]").kind).toBe("typed-text");
    });
  });
});
