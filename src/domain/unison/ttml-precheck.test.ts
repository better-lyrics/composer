import { describe, expect, it } from "vitest";
import { precheckUnisonTtml } from "@/domain/unison/ttml-precheck";
import { exportedTtml } from "@/test/edited-ttml";
import { EDITED_TTML_PROJECTS } from "@/test/edited-ttml-projects";

// -- Fixtures ------------------------------------------------------------------

function ttmlLine(spans: string): string {
  return `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:00.0" end="0:02.0">${spans}</p></div></body></tt>`;
}

const DEGENERATE_TTML = ttmlLine(
  '<span begin="0:00.0" end="0:00.0">How</span> ' +
    '<span begin="0:00.5" end="0:00.5">did</span> ' +
    '<span begin="0:01.0" end="0:01.0">I</span> ' +
    '<span begin="0:01.5" end="0:02.0">know</span>',
);

// -- Tests ---------------------------------------------------------------------

describe("precheckUnisonTtml", () => {
  it("passes Composer's own export for every fixture project", () => {
    for (const project of EDITED_TTML_PROJECTS.map((build) => build())) {
      expect(precheckUnisonTtml(exportedTtml(project.lines)), project.name).toEqual({ ok: true });
    }
  });

  describe("error paths", () => {
    it("flags a line break between word spans", () => {
      const ttml = ttmlLine(
        '<span begin="0:00.0" end="0:01.0">Hello</span>\n  <span begin="0:01.0" end="0:02.0">world</span>',
      );
      expect(precheckUnisonTtml(ttml)).toEqual({ ok: false, problem: "line-breaks" });
    });

    it("flags spaces padded inside word spans", () => {
      const trailing = ttmlLine(
        '<span begin="0:00.0" end="0:01.0">Hello </span><span begin="0:01.0" end="0:02.0">world</span>',
      );
      const leading = ttmlLine(
        '<span begin="0:00.0" end="0:01.0">Hello</span><span begin="0:01.0" end="0:02.0"> world</span>',
      );
      expect(precheckUnisonTtml(trailing)).toEqual({ ok: false, problem: "padded-words" });
      expect(precheckUnisonTtml(leading)).toEqual({ ok: false, problem: "padded-words" });
    });

    it("flags word timing that is mostly zero length", () => {
      expect(precheckUnisonTtml(DEGENERATE_TTML)).toEqual({ ok: false, problem: "zero-length-words" });
    });
  });

  describe("edge cases", () => {
    it("accepts zero-length punctuation spans and line-synced TTML", () => {
      const punctuation = ttmlLine(
        '<span begin="0:00.0" end="0:01.0">Hello</span> <span begin="0:01.0" end="0:01.0">,</span> <span begin="0:01.0" end="0:02.0">world</span>',
      );
      expect(precheckUnisonTtml(punctuation)).toEqual({ ok: true });
      expect(precheckUnisonTtml(ttmlLine("Hello world"))).toEqual({ ok: true });
    });
  });
});
