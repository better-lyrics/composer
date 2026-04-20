/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { parseLyricsFile } from "@/utils/lyrics-parsers";

describe("parseLyricsFile - plain LRC", () => {
  it("parses line-level timing without word timing", () => {
    const content = `[00:12.34]Hello world
[00:15.67]Next line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.hasTimingData).toBe(true);
    expect(result.lines).toHaveLength(2);

    expect(result.lines[0].begin).toBeCloseTo(12.34, 2);
    expect(result.lines[0].text).toBe("Hello world");
    expect(result.lines[0].words).toBeUndefined();
    expect(result.lines[0].end).toBeCloseTo(15.67, 2);

    expect(result.lines[1].begin).toBeCloseTo(15.67, 2);
    expect(result.lines[1].text).toBe("Next line");
    expect(result.lines[1].words).toBeUndefined();
  });

  it("extracts metadata tags", () => {
    const content = `[ti:Test Song]
[ar:Test Artist]
[al:Test Album]
[00:10.00]First line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.metadata.title).toBe("Test Song");
    expect(result.metadata.artist).toBe("Test Artist");
    expect(result.metadata.album).toBe("Test Album");
  });

  it("duplicates a line for each timestamp when multiple timestamps share text", () => {
    const content = `[00:10.00][00:30.00]Chorus line
[00:20.00]Verse line`;
    const result = parseLyricsFile("song.lrc", content);

    const chorusLines = result.lines.filter((l) => l.text === "Chorus line");
    expect(chorusLines).toHaveLength(2);
    expect(chorusLines.map((l) => l.begin).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([10, 30]);
  });
});

describe("parseLyricsFile - enhanced LRC (eLRC)", () => {
  it("parses inline word timestamps into WordTiming[]", () => {
    const content = `[00:12.00]<00:12.00>Hello <00:12.50>world
[00:15.00]<00:15.00>Next <00:15.50>line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines).toHaveLength(2);

    const line1 = result.lines[0];
    expect(line1.words).toBeDefined();
    expect(line1.words).toHaveLength(2);
    expect(line1.words?.[0].text).toBe("Hello ");
    expect(line1.words?.[0].begin).toBeCloseTo(12.0, 2);
    expect(line1.words?.[0].end).toBeCloseTo(12.5, 2);
    expect(line1.words?.[1].text).toBe("world");
    expect(line1.words?.[1].begin).toBeCloseTo(12.5, 2);
    expect(line1.words?.[1].end).toBeCloseTo(15.0, 2);

    expect(line1.begin).toBeCloseTo(12.0, 2);
    expect(line1.end).toBeCloseTo(15.0, 2);
    expect(line1.text).toBe("Hello world");
  });

  it("uses a trailing sentinel tag as the last word's end", () => {
    const content = `[00:12.00]<00:12.00>Hello <00:12.50>world<00:13.00>
[00:15.00]<00:15.00>Next <00:15.50>line<00:16.00>`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].words?.[1].end).toBeCloseTo(13.0, 2);
    expect(result.lines[0].end).toBeCloseTo(13.0, 2);
    expect(result.lines[1].words?.[1].end).toBeCloseTo(16.0, 2);
    expect(result.lines[1].end).toBeCloseTo(16.0, 2);
  });

  it("preserves metadata tags alongside word timing", () => {
    const content = `[ti:eLRC Test]
[ar:Artist]
[00:12.00]<00:12.00>Hello <00:12.50>world`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.metadata.title).toBe("eLRC Test");
    expect(result.metadata.artist).toBe("Artist");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].words).toHaveLength(2);
  });

  it("uses the line timestamp as the first word's begin when no leading inline tag is present", () => {
    const content = "[00:12.00]Hello <00:12.50>world<00:13.00>";
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines[0].words).toHaveLength(2);
    expect(result.lines[0].words?.[0].text).toBe("Hello ");
    expect(result.lines[0].words?.[0].begin).toBeCloseTo(12.0, 2);
    expect(result.lines[0].words?.[0].end).toBeCloseTo(12.5, 2);
    expect(result.lines[0].words?.[1].end).toBeCloseTo(13.0, 2);
  });

  it("rebuilds line text from word texts so no inline tags leak into display", () => {
    const content = "[00:12.00]<00:12.00>Hello <00:12.50>beautiful <00:13.00>world<00:13.50>";
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines[0].text).toBe("Hello beautiful world");
    expect(result.lines[0].words?.map((w) => w.text).join("")).toBe("Hello beautiful world");
  });

  it("falls back to line-level timing and strips inline tags when a line has multiple line timestamps", () => {
    const content = `[00:10.00][00:30.00]<00:10.00>Hello <00:10.50>world<00:11.00>
[00:20.00]Middle`;
    const result = parseLyricsFile("song.lrc", content);

    const chorusLines = result.lines.filter((l) => l.text === "Hello world");
    expect(chorusLines).toHaveLength(2);
    for (const line of chorusLines) {
      expect(line.words).toBeUndefined();
    }
    expect(chorusLines.some((l) => l.text.includes("<"))).toBe(false);
  });
});

describe("parseLyricsFile - SRT regression", () => {
  it("parses SRT blocks with line timing", () => {
    const content = `1
00:00:10,000 --> 00:00:12,500
First subtitle line

2
00:00:13,000 --> 00:00:15,500
Second subtitle line`;
    const result = parseLyricsFile("song.srt", content);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].begin).toBeCloseTo(10.0, 2);
    expect(result.lines[0].end).toBeCloseTo(12.5, 2);
    expect(result.lines[0].text).toBe("First subtitle line");
    expect(result.lines[1].begin).toBeCloseTo(13.0, 2);
    expect(result.lines[1].end).toBeCloseTo(15.5, 2);
  });
});
