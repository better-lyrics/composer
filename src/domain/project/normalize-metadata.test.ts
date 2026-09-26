import { describe, expect, it } from "vitest";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";

describe("normalizeLoadedMetadata", () => {
  it("upgrades legacy single artist string to an array", () => {
    const out = normalizeLoadedMetadata({ title: "T", artist: "Tyler, The Creator", album: "A", duration: 10 });
    expect(out.artists).toEqual(["Tyler, The Creator"]);
    expect("artist" in out).toBe(false);
  });
  it("passes through an already-migrated artists array", () => {
    const out = normalizeLoadedMetadata({ title: "T", artists: ["A", "B"], album: "", duration: 0 });
    expect(out.artists).toEqual(["A", "B"]);
  });
  describe("edge cases", () => {
    it("fills defaults for a sparse object", () => {
      const out = normalizeLoadedMetadata({});
      expect(out).toMatchObject({ title: "", artists: [], album: "", duration: 0 });
    });
    it("drops an empty legacy artist string to an empty array", () => {
      expect(normalizeLoadedMetadata({ artist: "" }).artists).toEqual([]);
    });
    it("is idempotent", () => {
      const once = normalizeLoadedMetadata({ artist: "X" });
      expect(normalizeLoadedMetadata(once)).toEqual(once);
    });
    it("preserves new optional fields", () => {
      const out = normalizeLoadedMetadata({
        artists: ["X"],
        isrc: "USQX91700001",
        songwriters: ["W"],
        extra: { spotifyId: "z" },
        language: "pt-BR",
      });
      expect(out).toMatchObject({
        isrc: "USQX91700001",
        songwriters: ["W"],
        extra: { spotifyId: "z" },
        language: "pt-BR",
      });
    });
    it("drops a whitespace-only legacy artist to an empty array", () => {
      expect(normalizeLoadedMetadata({ artist: "   " }).artists).toEqual([]);
    });
    it("regression: does not throw on a record with no metadata", () => {
      expect(normalizeLoadedMetadata(undefined)).toMatchObject({ title: "", artists: [], album: "", duration: 0 });
      expect(normalizeLoadedMetadata(null)).toMatchObject({ title: "", artists: [], album: "", duration: 0 });
    });
  });
  describe("invariants", () => {
    it("spells out every optional key so a spread clears stale values", () => {
      const stale = normalizeLoadedMetadata({
        artists: ["Old"],
        isrc: "USQX91700001",
        songwriters: ["W"],
        extra: { mood: "sad" },
        language: "ja",
      });
      const loaded = normalizeLoadedMetadata({ title: "New", artists: ["New"], album: "", duration: 0 });
      const merged = { ...stale, ...loaded };
      expect(merged.isrc).toBeUndefined();
      expect(merged.songwriters).toBeUndefined();
      expect(merged.extra).toBeUndefined();
      expect(merged.language).toBeUndefined();
      expect(merged.artists).toEqual(["New"]);
    });
    it("prefers artists over a stale legacy artist when both are present", () => {
      const out = normalizeLoadedMetadata({ artist: "Legacy", artists: ["New"] });
      expect(out.artists).toEqual(["New"]);
      expect("artist" in out).toBe(false);
    });
    it("never lets a default clobber a present field", () => {
      const out = normalizeLoadedMetadata({ title: "Keep", artist: "X" });
      expect(out.title).toBe("Keep");
      expect(out.artists).toEqual(["X"]);
    });
    it("survives a real IndexedDB-style JSON round-trip of a legacy record", () => {
      const legacy = { title: "T", artist: "Tyler, The Creator", album: "A", duration: 12 };
      const out = normalizeLoadedMetadata(JSON.parse(JSON.stringify(legacy)));
      expect(out.artists).toEqual(["Tyler, The Creator"]);
      expect("artist" in out).toBe(false);
    });
  });
});
