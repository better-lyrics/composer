import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { convertViaParser, type ConversionResult, type ParserConversion } from "@/pages/converters/convert-via-parser";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const LRC_CONVERSION: ParserConversion = {
  extension: "lrc",
  granularity: "auto",
  emptyMessage: "No timed lines found.",
  failureMessage: "Could not parse LRC.",
  logLabel: "LRC",
};

const QRC_CONVERSION: ParserConversion = {
  extension: "qrc",
  granularity: "auto",
  emptyMessage: "No timed lines found.",
  failureMessage: "Could not parse QRC.",
  logLabel: "QRC",
};

const ELRC_INPUT = "[00:00.50]<00:00.50>Hello <00:01.00>world<00:01.50>";

interface ConvertedProject {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: "line" | "word";
}

function expectConverted(result: ConversionResult): { ttml: string; projectPayload: string } {
  if ("error" in result) throw new Error(`expected a successful conversion, got "${result.error}"`);
  return result;
}

function projectOf(result: ConversionResult): ConvertedProject {
  return JSON.parse(expectConverted(result).projectPayload) as ConvertedProject;
}

// -- Tests --------------------------------------------------------------------

describe("convertViaParser", () => {
  it("produces TTML and a project payload from valid input", () => {
    const result = convertViaParser(LRC_CONVERSION, { input: ELRC_INPUT, filename: "input.lrc" });

    expect(expectConverted(result).ttml).toContain("<tt");
    expect(projectOf(result).lines).toHaveLength(1);
  });

  it("returns the empty message when nothing parses", () => {
    const result = convertViaParser(LRC_CONVERSION, { input: "not lyrics", filename: "input.lrc" });

    expect(result).toEqual({ error: "No timed lines found." });
  });

  it("appends the extension when the filename lacks it", () => {
    const result = convertViaParser(LRC_CONVERSION, { input: "[00:00.50]Hello", filename: "pasted" });

    expect(expectConverted(result).ttml).toContain("<tt");
  });

  it("forces line granularity when configured to", () => {
    const result = convertViaParser(
      { ...LRC_CONVERSION, granularity: "line" },
      { input: ELRC_INPUT, filename: "input.lrc" },
    );

    expect(projectOf(result).granularity).toBe("line");
  });

  it("reports word granularity when the parsed lines carry word timing", () => {
    expect(projectOf(convertViaParser(LRC_CONVERSION, { input: ELRC_INPUT, filename: "input.lrc" })).granularity).toBe(
      "word",
    );
  });

  it("reports line granularity when the parsed lines carry no word timing", () => {
    const result = convertViaParser(LRC_CONVERSION, { input: "[00:00.50]Hello\n[00:02.00]World", filename: "in.lrc" });

    expect(projectOf(result).granularity).toBe("line");
  });

  it("carries parsed agents through instead of the default voice", () => {
    const result = convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" });

    expect(projectOf(result).agents).toHaveLength(2);
    expect(expectConverted(result).ttml).toContain("Fox the Fox");
  });

  it("falls back to the shared default agent when the parser reports none", () => {
    const result = convertViaParser(LRC_CONVERSION, { input: ELRC_INPUT, filename: "input.lrc" });

    expect(projectOf(result).agents).toEqual(DEFAULT_AGENTS);
  });

  it("keeps the songwriters and extra fields the parser produced", () => {
    const result = convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" });
    const { metadata } = projectOf(result);

    expect(metadata.songwriters?.length).toBeGreaterThan(0);
    expect(metadata.extra?.qrcLyricsBy).toBeTruthy();
    expect(expectConverted(result).ttml).toContain('key="songwriter"');
  });

  it("lifts title, artists and album out of the parsed metadata", () => {
    const result = convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" });
    const { metadata } = projectOf(result);

    expect(metadata.title).toBe("Wanderlust");
    expect(metadata.artists).toEqual(["The Weeknd"]);
    expect(metadata.album).toBe("Kiss Land");
  });

  describe("edge cases", () => {
    it("returns the empty message for an empty input", () => {
      expect(convertViaParser(LRC_CONVERSION, { input: "", filename: "input.lrc" })).toEqual({
        error: "No timed lines found.",
      });
    });

    it("returns the empty message for whitespace-only input", () => {
      expect(convertViaParser(LRC_CONVERSION, { input: "   \n\t ", filename: "input.lrc" })).toEqual({
        error: "No timed lines found.",
      });
    });

    it("returns the configured empty message rather than a shared one", () => {
      const result = convertViaParser(
        { ...LRC_CONVERSION, emptyMessage: "No subtitle cues found." },
        { input: "not lyrics", filename: "input.lrc" },
      );

      expect(result).toEqual({ error: "No subtitle cues found." });
    });

    it("defaults title, artists and album when the parser reports no metadata", () => {
      const { metadata } = projectOf(convertViaParser(LRC_CONVERSION, { input: ELRC_INPUT, filename: "input.lrc" }));

      expect(metadata.title).toBe("");
      expect(metadata.artists).toEqual([]);
      expect(metadata.album).toBe("");
    });

    it("zeroes the duration even when the source declares one", () => {
      const result = convertViaParser(LRC_CONVERSION, {
        input: "[length:03:20]\n[00:00.50]Hello",
        filename: "input.lrc",
      });

      expect(projectOf(result).metadata.duration).toBe(0);
    });

    it("honours a filename that already carries the extension", () => {
      const result = convertViaParser(LRC_CONVERSION, { input: ELRC_INPUT, filename: "my-song.lrc" });

      expect(expectConverted(result).ttml).toContain("<tt");
    });
  });

  describe("invariants", () => {
    it("describes the same lines in the TTML and in the project payload", () => {
      const result = convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" });
      const { ttml } = expectConverted(result);
      const { lines } = projectOf(result);

      expect(ttml.match(/<p /g)).toHaveLength(lines.length);
    });

    it("names every agent a line references in the TTML head", () => {
      const result = convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" });
      const { ttml } = expectConverted(result);
      const { agents, lines } = projectOf(result);

      for (const id of new Set(lines.map((line) => line.agentId))) {
        expect(agents.some((agent) => agent.id === id)).toBe(true);
        expect(ttml).toContain(`<ttm:agent xml:id="${id}"`);
      }
    });

    it("produces the same output for the same input", () => {
      const first = projectOf(convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" }));
      const second = projectOf(convertViaParser(QRC_CONVERSION, { input: WANDERLUST_QRC, filename: "input.qrc" }));

      expect(first.lines.map(({ id, ...rest }) => rest)).toEqual(second.lines.map(({ id, ...rest }) => rest));
    });

    it("leaves the conversion config untouched", () => {
      const conversion: ParserConversion = { ...LRC_CONVERSION };
      convertViaParser(conversion, { input: ELRC_INPUT, filename: "input.lrc" });

      expect(conversion).toEqual(LRC_CONVERSION);
    });
  });
});
