import { type ParserConversion, convertViaParser } from "@/pages/converters/convert-via-parser";
import { TTML_OUTPUT } from "@/pages/converters/output-formats";
import { SINGER_TAGGED_LRC } from "@/test/lrc-fixtures";
import { describe, expect, it } from "vitest";

const LRC_CONVERSION: ParserConversion = {
  extension: "lrc",
  granularity: "auto",
  emptyMessage: "No timed lines found.",
  failureMessage: "Could not parse LRC.",
  logLabel: "LRC",
};

describe("convertViaParser with unsupported LRC tags", () => {
  it("refuses an LRC with singer and background vocal tags and says why", () => {
    const args = { input: SINGER_TAGGED_LRC, filename: "cry_babies.lrc", format: TTML_OUTPUT };
    expect(convertViaParser(LRC_CONVERSION, args)).toEqual({
      error:
        "This LRC uses singer or background vocal tags (v1:, [bg:]) that are not part of LRC. Use a TTML or plain LRC version instead.",
    });
  });

  describe("edge cases", () => {
    it("still converts an LRC whose lyrics only mention v1 or bg", () => {
      const args = { input: "[00:01.00]Track v1: the bg mix\n[00:02.00]Next", filename: "a.lrc", format: TTML_OUTPUT };
      expect(convertViaParser(LRC_CONVERSION, args)).toMatchObject({ skippedLines: 0 });
    });
  });
});
