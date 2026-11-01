import type { ProjectMetadata } from "@/domain/project/metadata";
import { metadataForNewSource, sourceSwapPatch, undoSourceSwap } from "@/domain/project/source-metadata";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const OLD_FILE = { title: "Midnight City", artists: ["M83"], album: "Hurry Up, We're Dreaming" };
const NEW_FILE = { title: "Midnight City (2024 Remaster)", artists: ["M83"], album: "Hurry Up (Remastered)" };

function metadata(overrides: Partial<ProjectMetadata>): ProjectMetadata {
  return { title: "", artists: [], album: "", duration: 0, ...overrides };
}

// -- Tests --------------------------------------------------------------------

describe("metadataForNewSource", () => {
  it("replaces what the old source provided with what the new source provides", () => {
    const current = metadata({ ...OLD_FILE, isrc: "USRC17607839" });
    const patch = metadataForNewSource(current, [], { ...OLD_FILE, isrc: "USRC17607839" }, NEW_FILE);
    expect(patch).toEqual({ title: NEW_FILE.title, album: NEW_FILE.album, isrc: undefined });
  });

  it("keeps every value the user typed", () => {
    const current = metadata({ title: "Midnight City (live take)", artists: ["M83", "Anthony Gonzalez"], album: "" });
    const patch = metadataForNewSource(current, [], OLD_FILE, NEW_FILE);
    expect(patch).toEqual({ album: NEW_FILE.album });
  });

  it("keeps details that came with the lyrics", () => {
    const current = metadata({ ...OLD_FILE });
    const patch = metadataForNewSource(current, ["title", "artists"], OLD_FILE, NEW_FILE);
    expect(patch).toEqual({ album: NEW_FILE.album });
  });

  describe("edge cases", () => {
    it("fills empty fields from the new source", () => {
      const patch = metadataForNewSource(metadata({}), [], {}, NEW_FILE);
      expect(patch).toEqual(NEW_FILE);
    });

    it("leaves a field empty when neither source has it", () => {
      expect(metadataForNewSource(metadata({}), [], {}, { title: "b-side" })).toEqual({ title: "b-side" });
    });

    it("matches artists by value, not by array identity", () => {
      const current = metadata({ ...OLD_FILE, artists: ["M83"] });
      const patch = metadataForNewSource(current, [], OLD_FILE, { ...NEW_FILE, artists: ["M83", "Zola Jesus"] });
      expect(patch.artists).toEqual(["M83", "Zola Jesus"]);
    });

    it("never touches fields a source does not describe", () => {
      const current = metadata({ ...OLD_FILE, songwriters: ["Anthony Gonzalez"], language: "en", duration: 244 });
      const patch = metadataForNewSource(current, [], OLD_FILE, NEW_FILE);
      expect(Object.keys(patch).every((key) => ["title", "artists", "album", "isrc"].includes(key))).toBe(true);
    });
  });

  describe("swaps", () => {
    it("drops a video thumbnail but keeps art that no video owns", () => {
      const fromVideo = metadata({ thumbnailDataUrl: "data:a", thumbnailForVideoId: "dQw4w9WgXcQ" });
      expect(sourceSwapPatch(fromVideo, [], {}, {})).toMatchObject({ thumbnailForVideoId: undefined });
      expect("thumbnailDataUrl" in sourceSwapPatch(metadata({ thumbnailDataUrl: "data:cover" }), [], {}, {})).toBe(
        false,
      );
    });

    it("undoes only fields that still hold the swap's value", () => {
      const before = metadata({ ...OLD_FILE });
      const patch = sourceSwapPatch(before, [], OLD_FILE, NEW_FILE);
      const edited = metadata({ ...before, ...patch, album: "Typed meanwhile" });
      expect(undoSourceSwap(edited, before, patch)).toEqual({ title: OLD_FILE.title });
    });
  });
});
