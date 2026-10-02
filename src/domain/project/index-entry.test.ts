import { type IndexEntryInput, buildIndexEntry } from "@/domain/project/index-entry";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

function input(overrides: Partial<IndexEntryInput> = {}): IndexEntryInput {
  return {
    id: "p1",
    metadata: { title: "Midnight City", artists: ["M83"], album: "Hurry Up, We're Dreaming", duration: 243 },
    lines: [],
    audioSource: undefined,
    storedAudioBytes: 0,
    updatedAt: 1_758_900_000_000,
    ...overrides,
  };
}

describe("buildIndexEntry", () => {
  it("copies identity and song details from the project", () => {
    const entry = buildIndexEntry(input());
    expect(entry).toMatchObject({
      id: "p1",
      title: "Midnight City",
      artists: ["M83"],
      album: "Hurry Up, We're Dreaming",
      updatedAt: 1_758_900_000_000,
    });
  });

  it("counts lyric lines and the ones with any timing", () => {
    const lines = [
      createLine({ text: "Waiting in a car", words: [{ text: "Waiting", begin: 1, end: 2 }] }),
      createLine({ text: "Waiting for a ride", begin: 3, end: 4 }),
      createLine({ text: "In the dark" }),
    ];
    const entry = buildIndexEntry(input({ lines }));
    expect(entry.lineCount).toBe(3);
    expect(entry.syncedLineCount).toBe(2);
    expect(entry.hasWordTiming).toBe(true);
  });

  it("reports the audio kind and the stored byte count", () => {
    const entry = buildIndexEntry(
      input({ audioSource: { kind: "youtube", videoId: "dX3k_QDnzHE" }, storedAudioBytes: 4_812_300 }),
    );
    expect(entry.audioKind).toBe("youtube");
    expect(entry.storedAudioBytes).toBe(4_812_300);
  });

  it("records the video id for a youtube audio source", () => {
    const entry = buildIndexEntry(input({ audioSource: { kind: "youtube", videoId: "dX3k_QDnzHE" } }));
    expect(entry.videoId).toBe("dX3k_QDnzHE");
  });

  describe("edge cases", () => {
    it("treats a project with no lines as zero of zero", () => {
      const entry = buildIndexEntry(input({ lines: [] }));
      expect(entry).toMatchObject({ lineCount: 0, syncedLineCount: 0, hasWordTiming: false });
    });

    it("ignores blank lines that the gutter can create", () => {
      const lines = [createLine({ text: "" }), createLine({ text: "   " }), createLine({ text: "Real line" })];
      expect(buildIndexEntry(input({ lines })).lineCount).toBe(1);
    });

    it("counts a line with only background timing as synced", () => {
      const lines = [
        createLine({
          text: "Main words",
          backgroundText: "(ooh)",
          backgroundWords: [{ text: "ooh", begin: 5, end: 6 }],
        }),
      ];
      expect(buildIndexEntry(input({ lines })).syncedLineCount).toBe(1);
    });

    it("reports audioKind none when the project has no audio source", () => {
      expect(buildIndexEntry(input({ audioSource: undefined })).audioKind).toBe("none");
    });

    it("keeps unicode titles as they are", () => {
      const entry = buildIndexEntry(
        input({ metadata: { title: "夜に駆ける", artists: ["YOASOBI"], album: "", duration: 0 } }),
      );
      expect(entry.title).toBe("夜に駆ける");
    });
  });

  describe("audio file name", () => {
    it("records the file name for a file audio source", () => {
      const entry = buildIndexEntry(input({ audioSource: { kind: "file", name: "Midnight City.flac" } }));
      expect(entry.audioFileName).toBe("Midnight City.flac");
    });

    it("omits the file name for youtube audio and for no audio", () => {
      expect("audioFileName" in buildIndexEntry(input({ audioSource: { kind: "youtube", videoId: "x" } }))).toBe(false);
      expect("audioFileName" in buildIndexEntry(input({ audioSource: undefined }))).toBe(false);
    });

    it("omits an empty file name", () => {
      expect("audioFileName" in buildIndexEntry(input({ audioSource: { kind: "file", name: "" } }))).toBe(false);
    });
  });

  describe("regressions", () => {
    it("regression: does not crash on a legacy record with a single artist field and missing lines", () => {
      const entry = buildIndexEntry(input({ metadata: { title: "Old", artist: "Someone" }, lines: undefined }));
      expect(entry.artists).toEqual(["Someone"]);
      expect(entry.lineCount).toBe(0);
    });

    it("regression: treats non-array stored lines as zero lines", () => {
      const entry = buildIndexEntry(input({ lines: "oops" }));
      expect(entry.lineCount).toBe(0);
    });

    it("regression: skips a null entry among stored lines", () => {
      const entry = buildIndexEntry(input({ lines: [null, { id: "x" }] }));
      expect(entry.lineCount).toBe(0);
    });

    it("regression: treats a line with a missing text field as having no main lyrics", () => {
      const entry = buildIndexEntry(input({ lines: [{ id: "y" }] }));
      expect(entry.lineCount).toBe(0);
    });

    it("regression: treats a line with a non-string text field as having no main lyrics", () => {
      const entry = buildIndexEntry(input({ lines: [{ id: "z", text: 42 }] }));
      expect(entry.lineCount).toBe(0);
    });
  });

  describe("invariants", () => {
    it("never counts more synced lines than lyric lines", () => {
      const lines = [createLine({ text: "a", begin: 1, end: 2 }), createLine({ text: "", begin: 3, end: 4 })];
      const entry = buildIndexEntry(input({ lines }));
      expect(entry.syncedLineCount).toBeLessThanOrEqual(entry.lineCount);
    });

    it("does not mutate the input lines", () => {
      const lines = [createLine({ text: "a" })];
      const snapshot = structuredClone(lines);
      buildIndexEntry(input({ lines }));
      expect(lines).toEqual(snapshot);
    });

    it("omits thumbnailDataUrl when the project has none", () => {
      expect("thumbnailDataUrl" in buildIndexEntry(input())).toBe(false);
    });

    it("omits videoId when the audio source is not youtube", () => {
      expect("videoId" in buildIndexEntry(input({ audioSource: { kind: "file", name: "a.mp3" } }))).toBe(false);
    });

    it("omits videoId when there is no audio source", () => {
      expect("videoId" in buildIndexEntry(input({ audioSource: undefined }))).toBe(false);
    });
  });

  describe("carried fields", () => {
    it("copies openedAt and lastTab when they are given", () => {
      const entry = buildIndexEntry(input({ openedAt: 1_758_900_500_000, lastTab: "sync" }));
      expect(entry.openedAt).toBe(1_758_900_500_000);
      expect(entry.lastTab).toBe("sync");
    });

    it("omits openedAt and lastTab when they are not given", () => {
      const entry = buildIndexEntry(input());
      expect("openedAt" in entry).toBe(false);
      expect("lastTab" in entry).toBe(false);
    });

    it("keeps an openedAt of zero", () => {
      expect(buildIndexEntry(input({ openedAt: 0 })).openedAt).toBe(0);
    });
  });

  describe("record size", () => {
    it("carries the record size when it is given", () => {
      const entry = buildIndexEntry(input({ recordBytes: 321 }));
      expect(entry.recordBytes).toBe(321);
    });

    it("leaves the record size out when it is not given", () => {
      const entry = buildIndexEntry(input());
      expect("recordBytes" in entry).toBe(false);
    });
  });
});
