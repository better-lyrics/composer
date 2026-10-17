import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { LIBRARY_FILTERS, filterCounts, libraryProjects, resumeProject } from "@/domain/project/library-view";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function entry(id: string, overrides: Partial<ProjectIndexEntry> = {}): ProjectIndexEntry {
  return indexEntry(id, { lineCount: 4, ...overrides });
}

const LIBRARY = [
  entry("empty", { lineCount: 0, updatedAt: 1 }),
  entry("unsynced", { updatedAt: 2 }),
  entry("syncing", { syncedLineCount: 2, updatedAt: 3, artists: ["M83"] }),
  entry("synced", { syncedLineCount: 4, updatedAt: 4 }),
];

function ids(entries: ProjectIndexEntry[]): string[] {
  return entries.map((e) => e.id);
}

// -- Tests --------------------------------------------------------------------

describe("libraryProjects", () => {
  it("filters by stage, with no lyrics counted as not synced", () => {
    const options = { query: "", sort: "edited" } as const;
    expect(ids(libraryProjects(LIBRARY, { ...options, filter: "all" }))).toEqual([
      "synced",
      "syncing",
      "unsynced",
      "empty",
    ]);
    expect(ids(libraryProjects(LIBRARY, { ...options, filter: "not-synced" }))).toEqual(["unsynced", "empty"]);
    expect(ids(libraryProjects(LIBRARY, { ...options, filter: "syncing" }))).toEqual(["syncing"]);
    expect(ids(libraryProjects(LIBRARY, { ...options, filter: "synced" }))).toEqual(["synced"]);
  });

  it("combines the filter with the search", () => {
    expect(ids(libraryProjects(LIBRARY, { filter: "all", query: "m83", sort: "edited" }))).toEqual(["syncing"]);
    expect(libraryProjects(LIBRARY, { filter: "synced", query: "m83", sort: "edited" })).toEqual([]);
  });

  describe("edge cases", () => {
    it("returns an empty list for no projects", () => {
      expect(libraryProjects([], { filter: "all", query: "", sort: "title" })).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("never mutates its input", () => {
      const input = [...LIBRARY];
      libraryProjects(input, { filter: "all", query: "", sort: "title" });
      expect(input).toEqual(LIBRARY);
    });
  });
});

describe("filterCounts", () => {
  it("counts each stage and the total in one pass", () => {
    expect(filterCounts(LIBRARY)).toEqual({ all: 4, "not-synced": 2, syncing: 1, synced: 1 });
  });

  describe("invariants", () => {
    it("the stage counts always add up to all", () => {
      const counts = filterCounts(LIBRARY);
      expect(counts["not-synced"] + counts.syncing + counts.synced).toBe(counts.all);
      expect(Object.keys(counts).toSorted()).toEqual([...LIBRARY_FILTERS].toSorted());
    });
  });
});

describe("resumeProject", () => {
  it("picks the most recently edited project", () => {
    expect(resumeProject(LIBRARY)?.id).toBe("synced");
  });

  describe("edge cases", () => {
    it("is undefined for an empty library", () => {
      expect(resumeProject([])).toBeUndefined();
    });

    it("breaks a tie by id", () => {
      expect(resumeProject([entry("b", { updatedAt: 5 }), entry("a", { updatedAt: 5 })])?.id).toBe("a");
    });
  });
});
