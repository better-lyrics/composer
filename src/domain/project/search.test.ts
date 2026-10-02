import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { normalizeProjectQuery, projectMatchesQuery } from "@/domain/project/search";
import { indexEntry } from "@/test/index-entries";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function entry(overrides: Partial<ProjectIndexEntry> = {}): ProjectIndexEntry {
  return indexEntry("p1", {
    title: "Midnight City",
    artists: ["M83"],
    album: "Hurry Up, We're Dreaming",
    ...overrides,
  });
}

// -- Tests --------------------------------------------------------------------

describe("projectMatchesQuery", () => {
  it("matches the title, an artist or the album, ignoring case", () => {
    expect(projectMatchesQuery(entry(), normalizeProjectQuery("midnight"))).toBe(true);
    expect(projectMatchesQuery(entry(), normalizeProjectQuery("m83"))).toBe(true);
    expect(projectMatchesQuery(entry(), normalizeProjectQuery("DREAMING"))).toBe(true);
    expect(projectMatchesQuery(entry(), normalizeProjectQuery("radiohead"))).toBe(false);
  });

  describe("edge cases", () => {
    it("matches everything for an empty or blank query", () => {
      expect(projectMatchesQuery(entry(), normalizeProjectQuery(""))).toBe(true);
      expect(projectMatchesQuery(entry(), normalizeProjectQuery("   "))).toBe(true);
    });

    it("matches the second artist of a collaboration", () => {
      expect(projectMatchesQuery(entry({ artists: ["Lady Gaga", "Bruno Mars"] }), normalizeProjectQuery("bruno"))).toBe(
        true,
      );
    });

    it("matches composed and decomposed unicode the same way", () => {
      const decomposedTitle = "Tití Me Preguntó".normalize("NFD");
      expect(projectMatchesQuery(entry({ title: decomposedTitle }), normalizeProjectQuery("tití"))).toBe(true);
      const decomposedQuery = normalizeProjectQuery("TITÍ".normalize("NFD"));
      expect(projectMatchesQuery(entry({ title: "Tití Me Preguntó" }), decomposedQuery)).toBe(true);
    });

    it("matches Japanese titles", () => {
      expect(projectMatchesQuery(entry({ title: "夜に駆ける" }), normalizeProjectQuery("駆ける"))).toBe(true);
    });
  });
});
