import { describe, expect, it } from "vitest";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { parseLyricsFile, PARSERS } from "@/utils/lyrics-parsers";
import type { LyricsFileType } from "@/utils/lyrics-parsers/detect";

describe("parser registry", () => {
  it("has an entry for every concrete LyricsFileType", () => {
    const concrete: Exclude<LyricsFileType, "unknown">[] = ["txt", "lrc", "srt", "ttml", "qrc"];
    for (const t of concrete) expect(typeof PARSERS[t]).toBe("function");
  });

  it("has exactly the concrete keys and no stray entries", () => {
    expect(Object.keys(PARSERS).sort()).toEqual(["lrc", "qrc", "srt", "ttml", "txt"]);
  });

  it("parses a dropped QRC file through parseLyricsFile", () => {
    const result = parseLyricsFile("wanderlust.qrc", WANDERLUST_QRC);
    expect(result.lines).toHaveLength(84);
    expect(result.agents).toHaveLength(2);
    expect(result.hasTimingData).toBe(true);
  });

  it("routes a QRC document served as .xml through the QRC parser", () => {
    const result = parseLyricsFile("wanderlust.xml", WANDERLUST_QRC);
    expect(result.lines).toHaveLength(84);
    expect(result.metadata.title).toBe("Wanderlust");
  });
});
