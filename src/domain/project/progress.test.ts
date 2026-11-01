import {
  hasLyrics,
  progressDescription,
  projectStage,
  syncedLinesLabel,
  syncedPercent,
} from "@/domain/project/progress";
import { describe, expect, it } from "vitest";

describe("projectStage", () => {
  it("is not-synced when no line has timing", () => {
    expect(projectStage({ lineCount: 12, syncedLineCount: 0 })).toBe("not-synced");
  });

  it("is syncing when some lines have timing", () => {
    expect(projectStage({ lineCount: 12, syncedLineCount: 5 })).toBe("syncing");
  });

  it("is synced when every line has timing", () => {
    expect(projectStage({ lineCount: 12, syncedLineCount: 12 })).toBe("synced");
  });

  describe("edge cases", () => {
    it("a project with no lines is not-synced", () => {
      expect(projectStage({ lineCount: 0, syncedLineCount: 0 })).toBe("not-synced");
    });

    it("a single synced line is synced", () => {
      expect(projectStage({ lineCount: 1, syncedLineCount: 1 })).toBe("synced");
    });
  });
});

describe("syncedPercent", () => {
  it("rounds the share of synced lines", () => {
    expect(syncedPercent({ lineCount: 3, syncedLineCount: 1 })).toBe(33);
    expect(syncedPercent({ lineCount: 3, syncedLineCount: 2 })).toBe(67);
  });

  describe("edge cases", () => {
    it("is 0 for a project with no lines", () => {
      expect(syncedPercent({ lineCount: 0, syncedLineCount: 0 })).toBe(0);
    });
  });

  describe("invariants", () => {
    it("never leaves 0 to 100, even for inconsistent counts", () => {
      expect(syncedPercent({ lineCount: 2, syncedLineCount: 5 })).toBe(100);
      expect(syncedPercent({ lineCount: 2, syncedLineCount: -1 })).toBe(0);
    });
  });
});

describe("progressDescription", () => {
  it("names the synced lines and the timing mode", () => {
    expect(progressDescription({ lineCount: 38, syncedLineCount: 23, hasWordTiming: true })).toBe(
      "23 of 38 lines synced, word by word",
    );
    expect(progressDescription({ lineCount: 34, syncedLineCount: 34, hasWordTiming: false })).toBe(
      "34 of 34 lines synced, line by line",
    );
  });

  describe("edge cases", () => {
    it("says there are no lyrics yet", () => {
      expect(progressDescription({ lineCount: 0, syncedLineCount: 0, hasWordTiming: false })).toBe("No lyrics yet");
    });

    it("leaves out the mode when nothing is timed", () => {
      expect(progressDescription({ lineCount: 58, syncedLineCount: 0, hasWordTiming: false })).toBe(
        "0 of 58 lines synced",
      );
    });
  });
});

describe("hasLyrics", () => {
  it("is true when the project has at least one line", () => {
    expect(hasLyrics({ lineCount: 1 })).toBe(true);
    expect(hasLyrics({ lineCount: 38 })).toBe(true);
  });

  describe("edge cases", () => {
    it("is false for a project with no lines", () => {
      expect(hasLyrics({ lineCount: 0 })).toBe(false);
    });
  });
});

describe("syncedLinesLabel", () => {
  it("counts the synced lines out of every line", () => {
    expect(syncedLinesLabel({ lineCount: 12, syncedLineCount: 5 })).toBe("5 of 12 lines synced");
  });

  describe("edge cases", () => {
    it("labels a project without lines as zero of zero", () => {
      expect(syncedLinesLabel({ lineCount: 0, syncedLineCount: 0 })).toBe("0 of 0 lines synced");
    });
  });

  describe("invariants", () => {
    it("clamps corrupt counts into range", () => {
      expect(syncedLinesLabel({ lineCount: 2, syncedLineCount: 5 })).toBe("2 of 2 lines synced");
      expect(syncedLinesLabel({ lineCount: 2, syncedLineCount: -1 })).toBe("0 of 2 lines synced");
    });

    it("matches the description's count", () => {
      const counts = { lineCount: 4, syncedLineCount: 3, hasWordTiming: true };
      expect(progressDescription(counts).startsWith(syncedLinesLabel(counts))).toBe(true);
    });
  });
});
