import { songSearchUrl } from "@/domain/musicbrainz/query";
import { describe, expect, it } from "vitest";

function queryOf(url: string): string | null {
  return new URL(url).searchParams.get("query");
}

describe("songSearchUrl", () => {
  it("searches title and first artist as phrases", () => {
    const url = songSearchUrl({ title: "Your Power", artist: "Billie Eilish", isrc: null });
    expect(queryOf(url)).toBe('recording:"Your Power" AND artist:"Billie Eilish"');
    expect(new URL(url).searchParams.get("fmt")).toBe("json");
  });

  it("uses the ISRC endpoint when an ISRC is known", () => {
    const url = songSearchUrl({ title: "Your Power", artist: "Billie Eilish", isrc: "USUM72105934" });
    expect(new URL(url).pathname).toBe("/ws/2/isrc/USUM72105934");
  });

  describe("edge cases", () => {
    it("omits the artist clause when no artist is known", () => {
      expect(queryOf(songSearchUrl({ title: "Yesterday", artist: " ", isrc: null }))).toBe('recording:"Yesterday"');
    });

    it("escapes quotes and backslashes inside phrases", () => {
      expect(queryOf(songSearchUrl({ title: 'Say "Hi" \\ Bye', artist: "", isrc: null }))).toBe(
        'recording:"Say \\"Hi\\" \\\\ Bye"',
      );
    });

    it("trims surrounding whitespace", () => {
      expect(queryOf(songSearchUrl({ title: "  Yesterday ", artist: " The Beatles ", isrc: null }))).toBe(
        'recording:"Yesterday" AND artist:"The Beatles"',
      );
    });
  });
});
