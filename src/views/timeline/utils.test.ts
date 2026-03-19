/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { distributeLinesTiming, distributeWordsInLine, formatTime, getLineTiming } from "./utils";

// -- distributeWordsInLine -----------------------------------------------------

describe("distributeWordsInLine", () => {
  it("distributes words proportionally by character length", () => {
    // "Hello" = 5 chars, "World" = 5 chars, total = 10 chars
    // Duration = 10 seconds, so each word gets 5 seconds
    const words = distributeWordsInLine("Hello World", 0, 10);

    expect(words).toHaveLength(2);
    expect(words[0]).toEqual({ text: "Hello ", begin: 0, end: 5 });
    expect(words[1]).toEqual({ text: "World", begin: 5, end: 10 });
  });

  it("handles single word", () => {
    const words = distributeWordsInLine("Hello", 0, 5);
    expect(words).toEqual([{ text: "Hello", begin: 0, end: 5 }]);
  });

  it("handles empty string", () => {
    const words = distributeWordsInLine("", 0, 5);
    expect(words).toEqual([]);
  });

  it("handles whitespace-only string", () => {
    const words = distributeWordsInLine("   ", 0, 5);
    expect(words).toEqual([]);
  });

  it("handles multiple spaces between words", () => {
    const words = distributeWordsInLine("Hello    World", 0, 10);
    expect(words).toHaveLength(2);
    expect(words[0].text).toBe("Hello ");
    expect(words[1].text).toBe("World");
  });

  it("handles non-zero begin time", () => {
    const words = distributeWordsInLine("Hi", 5, 7);
    expect(words).toEqual([{ text: "Hi", begin: 5, end: 7 }]);
  });
});

// -- distributeLinesTiming -----------------------------------------------------

describe("distributeLinesTiming", () => {
  it("distributes lines evenly across duration", () => {
    const lines = [
      { id: "1", text: "Line one", agentId: "v1" },
      { id: "2", text: "Line two", agentId: "v1" },
    ];
    const duration = 10;

    const result = distributeLinesTiming(lines, duration);

    expect(result[0].begin).toBe(0);
    expect(result[0].end).toBe(5);
    expect(result[1].begin).toBe(5);
    expect(result[1].end).toBe(10);
  });

  it("includes distributed words for each line", () => {
    const lines = [{ id: "1", text: "Hello World", agentId: "v1" }];
    const duration = 11;

    const result = distributeLinesTiming(lines, duration);

    expect(result[0].words).toHaveLength(2);
    expect(result[0].words[0].text).toBe("Hello ");
    expect(result[0].words[1].text).toBe("World");
  });

  it("handles empty array", () => {
    const result = distributeLinesTiming([], 10);
    expect(result).toEqual([]);
  });

  it("preserves original line properties", () => {
    const lines = [{ id: "abc", text: "Test", agentId: "v2", extra: "data" }];
    const result = distributeLinesTiming(lines, 5);

    expect(result[0].id).toBe("abc");
    expect(result[0].agentId).toBe("v2");
    expect((result[0] as { extra: string }).extra).toBe("data");
  });
});

// -- getLineTiming -------------------------------------------------------------

describe("getLineTiming", () => {
  it("returns timing from words when available", () => {
    const line = {
      id: "1",
      text: "Hello",
      agentId: "v1",
      words: [
        { text: "Hello", begin: 2, end: 5 },
        { text: "World", begin: 5, end: 8 },
      ],
    };

    const timing = getLineTiming(line);

    expect(timing).toEqual({ begin: 2, end: 8 });
  });

  it("returns direct timing when no words", () => {
    const line = {
      id: "1",
      text: "Hello",
      agentId: "v1",
      begin: 3,
      end: 7,
    };

    const timing = getLineTiming(line);

    expect(timing).toEqual({ begin: 3, end: 7 });
  });

  it("returns null when no timing available", () => {
    const line = {
      id: "1",
      text: "Hello",
      agentId: "v1",
    };

    const timing = getLineTiming(line);

    expect(timing).toBeNull();
  });

  it("prefers words timing over direct timing", () => {
    const line = {
      id: "1",
      text: "Hello",
      agentId: "v1",
      begin: 0,
      end: 10,
      words: [{ text: "Hello", begin: 2, end: 5 }],
    };

    const timing = getLineTiming(line);

    expect(timing).toEqual({ begin: 2, end: 5 });
  });

  it("handles empty words array", () => {
    const line = {
      id: "1",
      text: "Hello",
      agentId: "v1",
      begin: 3,
      end: 7,
      words: [],
    };

    const timing = getLineTiming(line);

    expect(timing).toEqual({ begin: 3, end: 7 });
  });
});

// -- formatTime ----------------------------------------------------------------

describe("formatTime", () => {
  it("formats zero", () => {
    expect(formatTime(0)).toBe("0:00.00");
  });

  it("formats seconds with centiseconds", () => {
    expect(formatTime(5.25)).toBe("0:05.25");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(65.5)).toBe("1:05.50");
  });

  it("formats multiple minutes", () => {
    expect(formatTime(126)).toBe("2:06.00");
  });

  it("pads seconds correctly", () => {
    expect(formatTime(61)).toBe("1:01.00");
  });

  it("rounds centiseconds down", () => {
    expect(formatTime(1.999)).toBe("0:01.99");
  });
});
