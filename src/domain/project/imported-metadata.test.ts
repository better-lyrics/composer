import { describe, expect, it } from "vitest";
import {
  filledMetadata,
  importedKeysAfterWrite,
  isMetadataKey,
  metadataAfterImport,
} from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";

// -- Fixtures -----------------------------------------------------------------

function songMetadata(overrides: Partial<ProjectMetadata> = {}): ProjectMetadata {
  return normalizeLoadedMetadata({ title: "Tag Title", artists: ["Tag Artist"], album: "Tag Album", ...overrides });
}

// -- Tests --------------------------------------------------------------------

describe("filledMetadata", () => {
  it("keeps the values a parse actually carries", () => {
    expect(filledMetadata({ title: "A", artists: ["B"], duration: 12 })).toEqual({
      title: "A",
      artists: ["B"],
      duration: 12,
    });
  });

  describe("edge cases", () => {
    it("drops empty strings, empty lists, empty maps, zero and undefined", () => {
      expect(filledMetadata({ title: "", artists: [], extra: {}, duration: 0, isrc: undefined })).toEqual({});
    });

    it("returns an empty object for an empty patch", () => {
      expect(filledMetadata({})).toEqual({});
    });
  });
});

describe("isMetadataKey", () => {
  it("accepts a real metadata field", () => {
    expect(isMetadataKey("title")).toBe(true);
  });

  describe("edge cases", () => {
    it("rejects inherited object keys such as constructor and toString", () => {
      expect(isMetadataKey("constructor")).toBe(false);
      expect(isMetadataKey("toString")).toBe(false);
    });

    it("rejects an unknown key", () => {
      expect(isMetadataKey("mood")).toBe(false);
    });
  });
});

describe("metadataAfterImport", () => {
  it("keeps every field the song brought when the import carries none", () => {
    const current = songMetadata();
    expect(metadataAfterImport(current, [], {})).toEqual({ metadata: current, importedKeys: [] });
  });

  it("clears the fields the previous import brought before applying the next one", () => {
    const current = songMetadata({ title: "Imported", isrc: "USRC17607839" });
    const { metadata, importedKeys } = metadataAfterImport(current, ["title", "isrc"], { album: "New Album" });
    expect(metadata).toMatchObject({ title: "", isrc: undefined, artists: ["Tag Artist"], album: "New Album" });
    expect(importedKeys).toEqual(["album"]);
  });

  describe("edge cases", () => {
    it("does not let an empty incoming value replace a song field", () => {
      const { metadata, importedKeys } = metadataAfterImport(songMetadata(), [], { title: "", artists: [] });
      expect(metadata).toMatchObject({ title: "Tag Title", artists: ["Tag Artist"] });
      expect(importedKeys).toEqual([]);
    });

    it("records a key the import writes again after clearing it", () => {
      const { metadata, importedKeys } = metadataAfterImport(songMetadata({ title: "Old" }), ["title"], {
        title: "New",
      });
      expect(metadata.title).toBe("New");
      expect(importedKeys).toEqual(["title"]);
    });
  });

  describe("invariants", () => {
    it("does not mutate the current metadata", () => {
      const current = songMetadata();
      const snapshot = structuredClone(current);
      metadataAfterImport(current, ["title", "artists"], { album: "X" });
      expect(current).toEqual(snapshot);
    });

    it("records exactly the keys whose incoming value is non-empty", () => {
      const { importedKeys } = metadataAfterImport(songMetadata(), [], { title: "A", album: "", language: "en" });
      expect(importedKeys.toSorted()).toEqual(["language", "title"]);
    });
  });
});

describe("importedKeysAfterWrite", () => {
  it("drops the keys another writer now owns", () => {
    expect(importedKeysAfterWrite(["title", "album"], { title: "Mine" })).toEqual(["album"]);
  });

  describe("edge cases", () => {
    it("treats an explicit undefined as a write", () => {
      expect(importedKeysAfterWrite(["isrc"], { isrc: undefined })).toEqual([]);
    });

    it("keeps every key for an empty write", () => {
      expect(importedKeysAfterWrite(["title"], {})).toEqual(["title"]);
    });
  });
});
