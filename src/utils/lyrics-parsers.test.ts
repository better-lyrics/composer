import { describe, expect, it } from "vitest";
import { lineText } from "@/domain/line/text";
import { mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { parseLyricsFile } from "@/utils/lyrics-parsers";

describe("parseLyricsFile - plain LRC", () => {
  it("parses line-level timing without word timing", () => {
    const content = `[00:12.34]Hello world
[00:15.67]Next line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.hasTimingData).toBe(true);
    expect(result.lines).toHaveLength(2);

    expect(mainTrack(result.lines[0]).begin).toBeCloseTo(12.34, 2);
    expect(lineText(result.lines[0])).toBe("Hello world");
    expect(roleWords(result.lines[0], "main")).toBeUndefined();
    expect(mainTrack(result.lines[0]).end).toBeCloseTo(15.67, 2);

    // The last line has no following line and no [length:] tag, so its end is
    // unknown: it parses as an untimed line rather than a begin-only line.
    expect(mainTrack(result.lines[1]).begin).toBeUndefined();
    expect(lineText(result.lines[1])).toBe("Next line");
    expect(roleWords(result.lines[1], "main")).toBeUndefined();
  });

  it("extends the last line to the [length:] tag when present", () => {
    const content = `[length:00:20.00]
[00:12.34]Hello world
[00:15.67]Next line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(mainTrack(result.lines[1]).begin).toBeCloseTo(15.67, 2);
    expect(mainTrack(result.lines[1]).end).toBeCloseTo(20.0, 2);
  });

  it("extends the last line to the caller-supplied audio duration when there is no [length:] tag", () => {
    const content = `[00:12.34]Hello world
[00:15.67]Next line`;
    const result = parseLyricsFile("song.lrc", content, 25);

    expect(mainTrack(result.lines[1]).begin).toBeCloseTo(15.67, 2);
    expect(mainTrack(result.lines[1]).end).toBeCloseTo(25.0, 2);
  });

  it("extracts metadata tags", () => {
    const content = `[ti:Test Song]
[ar:Test Artist]
[al:Test Album]
[00:10.00]First line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.metadata.title).toBe("Test Song");
    expect(result.metadata.artists).toEqual(["Test Artist"]);
    expect(result.metadata.album).toBe("Test Album");
  });

  it("duplicates a line for each timestamp when multiple timestamps share text", () => {
    const content = `[length:00:40.00]
[00:10.00][00:30.00]Chorus line
[00:20.00]Verse line`;
    const result = parseLyricsFile("song.lrc", content);

    const chorusLines = result.lines.filter((l) => lineText(l) === "Chorus line");
    expect(chorusLines).toHaveLength(2);
    expect(chorusLines.map((l) => mainTrack(l).begin).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([10, 30]);
  });
});

describe("parseLyricsFile - enhanced LRC (eLRC)", () => {
  it("parses inline word timestamps into WordTiming[]", () => {
    const content = `[00:12.00]<00:12.00>Hello <00:12.50>world
[00:15.00]<00:15.00>Next <00:15.50>line`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines).toHaveLength(2);

    const line1 = result.lines[0];
    expect(roleWords(line1, "main")).toBeDefined();
    expect(timedSyllables(mainTrack(line1))).toHaveLength(2);
    expect(timedSyllables(mainTrack(line1))[0]).toMatchObject({ text: "Hello", sep: " " });
    expect(timedSyllables(mainTrack(line1))[0].begin).toBeCloseTo(12.0, 2);
    expect(timedSyllables(mainTrack(line1))[0].end).toBeCloseTo(12.5, 2);
    expect(timedSyllables(mainTrack(line1))[1].text).toBe("world");
    expect(timedSyllables(mainTrack(line1))[1].begin).toBeCloseTo(12.5, 2);
    expect(timedSyllables(mainTrack(line1))[1].end).toBeCloseTo(15.0, 2);

    // A word-synced line carries its timing in `words`, not at line level.
    expect(mainTrack(line1).begin).toBeUndefined();
    expect(mainTrack(line1).end).toBeUndefined();
    expect(lineText(line1)).toBe("Hello world");
  });

  it("uses a trailing sentinel tag as the last word's end", () => {
    const content = `[00:12.00]<00:12.00>Hello <00:12.50>world<00:13.00>
[00:15.00]<00:15.00>Next <00:15.50>line<00:16.00>`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.lines).toHaveLength(2);
    expect(timedSyllables(mainTrack(result.lines[0]))[1].end).toBeCloseTo(13.0, 2);
    expect(timedSyllables(mainTrack(result.lines[1]))[1].end).toBeCloseTo(16.0, 2);
  });

  it("preserves metadata tags alongside word timing", () => {
    const content = `[ti:eLRC Test]
[ar:Artist]
[00:12.00]<00:12.00>Hello <00:12.50>world`;
    const result = parseLyricsFile("song.lrc", content);

    expect(result.metadata.title).toBe("eLRC Test");
    expect(result.metadata.artists).toEqual(["Artist"]);
    expect(result.lines).toHaveLength(1);
    expect(timedSyllables(mainTrack(result.lines[0]))).toHaveLength(2);
  });

  it("uses the line timestamp as the first word's begin when no leading inline tag is present", () => {
    const content = "[00:12.00]Hello <00:12.50>world<00:13.00>";
    const result = parseLyricsFile("song.lrc", content);

    expect(timedSyllables(mainTrack(result.lines[0]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(result.lines[0]))[0]).toMatchObject({ text: "Hello", sep: " " });
    expect(timedSyllables(mainTrack(result.lines[0]))[0].begin).toBeCloseTo(12.0, 2);
    expect(timedSyllables(mainTrack(result.lines[0]))[0].end).toBeCloseTo(12.5, 2);
    expect(timedSyllables(mainTrack(result.lines[0]))[1].end).toBeCloseTo(13.0, 2);
  });

  it("rebuilds line text from word texts so no inline tags leak into display", () => {
    const content = "[00:12.00]<00:12.00>Hello <00:12.50>beautiful <00:13.00>world<00:13.50>";
    const result = parseLyricsFile("song.lrc", content);

    expect(lineText(result.lines[0])).toBe("Hello beautiful world");
    expect(
      timedSyllables(mainTrack(result.lines[0]))
        .map((w) => w.text + w.sep)
        .join(""),
    ).toBe("Hello beautiful world");
  });

  it("falls back to line-level timing and strips inline tags when a line has multiple line timestamps", () => {
    const content = `[00:10.00][00:30.00]<00:10.00>Hello <00:10.50>world<00:11.00>
[00:20.00]Middle`;
    const result = parseLyricsFile("song.lrc", content);

    const chorusLines = result.lines.filter((l) => lineText(l) === "Hello world");
    expect(chorusLines).toHaveLength(2);
    for (const line of chorusLines) {
      expect(roleWords(line, "main")).toBeUndefined();
    }
    expect(chorusLines.some((l) => lineText(l).includes("<"))).toBe(false);
  });
});

describe("parseLyricsFile - TTML syllable-group inference", () => {
  it("joins the syllables of a multi-syllable word in TTML", () => {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:00:00.000" end="00:00:02.500">
        <span begin="00:00:00.000" end="00:00:00.500">hello</span>
        <span begin="00:00:00.500" end="00:00:00.700">ev</span><span begin="00:00:00.700" end="00:00:01.000">er</span><span begin="00:00:01.000" end="00:00:01.500">y </span><span begin="00:00:01.500" end="00:00:02.500">world</span>
      </p>
    </div>
  </body>
</tt>`;
    const result = parseLyricsFile("song.ttml", content);

    expect(result.lines).toHaveLength(1);
    const words = roleWords(result.lines[0], "main");
    expect(words).toBeDefined();
    if (!words) return;
    expect(words.map((w) => w.text.trimEnd())).toEqual(["hello", "ev", "er", "y", "world"]);

    expect(words.map((w) => w.joinsNext)).toEqual([false, true, true, false, false]);
  });

  it("joins nothing when every word in a TTML line is standalone", () => {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:00:00.000" end="00:00:02.000">
        <span begin="00:00:00.000" end="00:00:01.000">hello</span> <span begin="00:00:01.000" end="00:00:02.000">world</span>
      </p>
    </div>
  </body>
</tt>`;
    const result = parseLyricsFile("song.ttml", content);

    const words = roleWords(result.lines[0], "main");
    expect(words).toBeDefined();
    if (!words) return;
    expect(words.every((w) => !w.joinsNext)).toBe(true);
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
    expect(mainTrack(result.lines[0]).begin).toBeCloseTo(10.0, 2);
    expect(mainTrack(result.lines[0]).end).toBeCloseTo(12.5, 2);
    expect(lineText(result.lines[0])).toBe("First subtitle line");
    expect(mainTrack(result.lines[1]).begin).toBeCloseTo(13.0, 2);
    expect(mainTrack(result.lines[1]).end).toBeCloseTo(15.5, 2);
  });
});
