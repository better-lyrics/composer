import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { LIBRARY_SORTS, byMostRecentlyEdited, compareProjects, isLibrarySort } from "@/domain/project/library-order";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function entry(id: string, overrides: Partial<ProjectIndexEntry> = {}): ProjectIndexEntry {
  return indexEntry(id, { lineCount: 10, ...overrides });
}

function ids(entries: ProjectIndexEntry[]): string[] {
  return entries.map((e) => e.id);
}

// -- Tests --------------------------------------------------------------------

describe("compareProjects", () => {
  it("orders by last edited, newest first", () => {
    const list = [entry("a", { updatedAt: 1 }), entry("b", { updatedAt: 3 }), entry("c", { updatedAt: 2 })];
    expect(ids(list.toSorted(compareProjects("edited")))).toEqual(["b", "c", "a"]);
  });

  it("orders by title A to Z, with Untitled where its fallback sorts", () => {
    const list = [entry("1", { title: "banana" }), entry("2", { title: "Apple" }), entry("3", { title: "" })];
    expect(ids(list.toSorted(compareProjects("title")))).toEqual(["2", "1", "3"]);
  });

  it("orders by artist A to Z and puts projects with no artist last", () => {
    const list = [
      entry("none", { artists: [] }),
      entry("m83", { artists: ["M83"] }),
      entry("aespa", { artists: ["aespa"] }),
    ];
    expect(ids(list.toSorted(compareProjects("artist")))).toEqual(["aespa", "m83", "none"]);
  });

  it("orders by progress, least synced first", () => {
    const list = [
      entry("done", { syncedLineCount: 10 }),
      entry("none", { syncedLineCount: 0 }),
      entry("half", { syncedLineCount: 5 }),
    ];
    expect(ids(list.toSorted(compareProjects("progress")))).toEqual(["none", "half", "done"]);
  });

  describe("invariants", () => {
    it("breaks every tie by last edited, then by id, so the order is total", () => {
      const list = [
        entry("b", { title: "Same", updatedAt: 5 }),
        entry("a", { title: "Same", updatedAt: 5 }),
        entry("c", { title: "Same", updatedAt: 9 }),
      ];
      for (const sort of LIBRARY_SORTS) {
        const sorted = ids(list.toSorted(compareProjects(sort)));
        expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("a"));
        expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
      }
    });

    it("byMostRecentlyEdited is the edited comparator", () => {
      const a = entry("a", { updatedAt: 1 });
      const b = entry("b", { updatedAt: 2 });
      expect(Math.sign(byMostRecentlyEdited(a, b))).toBe(Math.sign(compareProjects("edited")(a, b)));
    });
  });
});

describe("isLibrarySort", () => {
  it("accepts every sort and rejects anything else", () => {
    for (const sort of LIBRARY_SORTS) expect(isLibrarySort(sort)).toBe(true);
    expect(isLibrarySort("Title")).toBe(false);
    expect(isLibrarySort(undefined)).toBe(false);
  });
});
