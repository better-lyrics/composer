import {
  hasClearableYouTubeAudio,
  hasStoredYouTubeAudio,
  isCachedYouTubeAudio,
  storedAudioProjects,
} from "@/domain/storage/stored-audio";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

const ENTRIES = [
  indexEntry("small-file", { title: "Small", audioKind: "file", storedAudioBytes: 10 }),
  indexEntry("big-yt", { title: "Big", audioKind: "youtube", storedAudioBytes: 90 }),
  indexEntry("missing", { title: "Missing", audioKind: "file", storedAudioBytes: 0 }),
  indexEntry("mid-file", { title: "Mid", audioKind: "file", storedAudioBytes: 50 }),
  indexEntry("streamed", { title: "Streamed", audioKind: "youtube", storedAudioBytes: 0 }),
];

describe("storedAudioProjects", () => {
  it("lists every project with stored audio, largest first", () => {
    expect(storedAudioProjects(ENTRIES, "all").map((entry) => entry.id)).toEqual(["big-yt", "mid-file", "small-file"]);
  });

  it("filters by local files or YouTube", () => {
    expect(storedAudioProjects(ENTRIES, "local").map((entry) => entry.id)).toEqual(["mid-file", "small-file"]);
    expect(storedAudioProjects(ENTRIES, "youtube").map((entry) => entry.id)).toEqual(["big-yt"]);
  });

  describe("edge cases", () => {
    it("is empty when nothing is stored", () => {
      expect(storedAudioProjects([indexEntry("a")], "all")).toEqual([]);
    });

    it("breaks size ties by title, then by id", () => {
      const tied = [
        indexEntry("b2", { title: "Bravo", audioKind: "file", storedAudioBytes: 5 }),
        indexEntry("a1", { title: "Alpha", audioKind: "file", storedAudioBytes: 5 }),
        indexEntry("b1", { title: "Bravo", audioKind: "file", storedAudioBytes: 5 }),
      ];
      expect(storedAudioProjects(tied, "all").map((entry) => entry.id)).toEqual(["a1", "b1", "b2"]);
    });
  });

  describe("invariants", () => {
    it("never changes the input order", () => {
      const before = ENTRIES.map((entry) => entry.id);
      storedAudioProjects(ENTRIES, "all");
      expect(ENTRIES.map((entry) => entry.id)).toEqual(before);
    });
  });
});

describe("isCachedYouTubeAudio", () => {
  it("is YouTube audio with stored bytes", () => {
    expect(isCachedYouTubeAudio({ audioKind: "youtube", storedAudioBytes: 1 })).toBe(true);
    expect(isCachedYouTubeAudio({ audioKind: "youtube", storedAudioBytes: 0 })).toBe(false);
    expect(isCachedYouTubeAudio({ audioKind: "file", storedAudioBytes: 1 })).toBe(false);
    expect(isCachedYouTubeAudio({ audioKind: "none", storedAudioBytes: 1 })).toBe(false);
  });
});

describe("hasStoredYouTubeAudio", () => {
  it("is true only when some YouTube audio is stored", () => {
    expect(hasStoredYouTubeAudio(ENTRIES)).toBe(true);
    expect(hasStoredYouTubeAudio(ENTRIES.filter((entry) => entry.id !== "big-yt"))).toBe(false);
    expect(hasStoredYouTubeAudio([])).toBe(false);
  });
});

describe("hasClearableYouTubeAudio", () => {
  it("is true when a project that is not in use has cached YouTube audio", () => {
    expect(hasClearableYouTubeAudio(ENTRIES, () => false)).toBe(true);
  });

  describe("edge cases", () => {
    it("is false when the only cached YouTube audio belongs to a project in use", () => {
      expect(hasClearableYouTubeAudio(ENTRIES, (id) => id === "big-yt")).toBe(false);
    });

    it("is false with no entries", () => {
      expect(hasClearableYouTubeAudio([], () => false)).toBe(false);
    });
  });
});
