import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { recentProjects } from "@/domain/project/recent-projects";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function entry(id: string, overrides: Partial<ProjectIndexEntry> = {}): ProjectIndexEntry {
  return {
    id,
    title: id,
    artists: [],
    album: "",
    lineCount: 0,
    syncedLineCount: 0,
    hasWordTiming: false,
    audioKind: "none",
    storedAudioBytes: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const ENTRIES = [
  entry("espresso", { title: "Espresso", artists: ["Sabrina Carpenter"], album: "Short n' Sweet", updatedAt: 30 }),
  entry("midnight", { title: "Midnight City", artists: ["M83"], album: "Hurry Up, We're Dreaming", updatedAt: 50 }),
  entry("yoru", { title: "夜に駆ける", artists: ["YOASOBI"], updatedAt: 10 }),
];

// -- Tests --------------------------------------------------------------------

describe("recentProjects", () => {
  it("orders by last edited, newest first", () => {
    const ids = recentProjects(ENTRIES, { excludeId: undefined, query: "", limit: 6 }).map((e) => e.id);
    expect(ids).toEqual(["midnight", "espresso", "yoru"]);
  });

  it("leaves out the open project", () => {
    const ids = recentProjects(ENTRIES, { excludeId: "midnight", query: "", limit: 6 }).map((e) => e.id);
    expect(ids).toEqual(["espresso", "yoru"]);
  });

  it("matches the query against title, artists and album, ignoring case", () => {
    const byArtist = recentProjects(ENTRIES, { excludeId: undefined, query: "sabrina", limit: 6 });
    const byAlbum = recentProjects(ENTRIES, { excludeId: undefined, query: "HURRY", limit: 6 });
    expect(byArtist.map((e) => e.id)).toEqual(["espresso"]);
    expect(byAlbum.map((e) => e.id)).toEqual(["midnight"]);
  });

  describe("edge cases", () => {
    it("trims the query and treats whitespace as no query", () => {
      expect(recentProjects(ENTRIES, { excludeId: undefined, query: "   ", limit: 6 })).toHaveLength(3);
      expect(recentProjects(ENTRIES, { excludeId: undefined, query: "  city ", limit: 6 })[0].id).toBe("midnight");
    });

    it("matches unicode titles", () => {
      expect(recentProjects(ENTRIES, { excludeId: undefined, query: "夜に", limit: 6 })[0].id).toBe("yoru");
    });

    it("caps the result at the limit", () => {
      expect(recentProjects(ENTRIES, { excludeId: undefined, query: "", limit: 2 })).toHaveLength(2);
    });

    it("returns nothing for no entries or no match", () => {
      expect(recentProjects([], { excludeId: undefined, query: "", limit: 6 })).toEqual([]);
      expect(recentProjects(ENTRIES, { excludeId: undefined, query: "zzz", limit: 6 })).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("does not reorder or change the input", () => {
      const input = [...ENTRIES];
      recentProjects(input, { excludeId: "espresso", query: "", limit: 1 });
      expect(input).toEqual(ENTRIES);
    });
  });

  describe("regressions", () => {
    it("breaks a tie in updatedAt by id, regardless of input order", () => {
      const alpha = entry("alpha", { updatedAt: 20 });
      const bravo = entry("bravo", { updatedAt: 20 });
      const forward = recentProjects([bravo, alpha], { excludeId: undefined, query: "", limit: 6 });
      const backward = recentProjects([alpha, bravo], { excludeId: undefined, query: "", limit: 6 });
      expect(forward.map((e) => e.id)).toEqual(["alpha", "bravo"]);
      expect(backward.map((e) => e.id)).toEqual(["alpha", "bravo"]);
    });

    it("matches an NFD-stored title against an NFC query", () => {
      const decomposed = entry("cafe", { title: "Café".normalize("NFD"), updatedAt: 5 });
      const result = recentProjects([decomposed], { excludeId: undefined, query: "café", limit: 6 });
      expect(result.map((e) => e.id)).toEqual(["cafe"]);
    });
  });
});
