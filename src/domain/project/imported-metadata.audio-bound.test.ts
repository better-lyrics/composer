import { AUDIO_BOUND_METADATA_KEYS, metadataAfterImport } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

function thisSong(): ProjectMetadata {
  return normalizeLoadedMetadata({
    title: "Mine",
    artists: [],
    album: "",
    duration: 200,
    thumbnailDataUrl: "data:mine",
    thumbnailForVideoId: "MINE",
  });
}

const OTHER_SONG: Partial<ProjectMetadata> = {
  title: "Other",
  duration: 99,
  thumbnailDataUrl: "data:other",
  thumbnailForVideoId: "OTHER",
};

// -- Tests --------------------------------------------------------------------

describe("audio-bound metadata on a lyrics import", () => {
  it("names the keys that belong to the loaded audio", () => {
    expect([...AUDIO_BOUND_METADATA_KEYS].toSorted()).toEqual(["duration", "thumbnailDataUrl", "thumbnailForVideoId"]);
  });

  it("keeps this song's artwork, video id and duration when another source brings its own", () => {
    const next = metadataAfterImport(thisSong(), [], OTHER_SONG);
    expect(next.metadata.thumbnailDataUrl).toBe("data:mine");
    expect(next.metadata.thumbnailForVideoId).toBe("MINE");
    expect(next.metadata.duration).toBe(200);
    expect(next.metadata.title).toBe("Other");
  });

  it("never marks an audio-bound key as imported", () => {
    expect(metadataAfterImport(thisSong(), [], OTHER_SONG).importedKeys).toEqual(["title"]);
  });

  describe("regressions", () => {
    it("regression: a later import never releases the artwork, even if an older import listed it", () => {
      const next = metadataAfterImport(
        thisSong(),
        ["title", "thumbnailDataUrl", "thumbnailForVideoId", "duration"],
        {},
      );
      expect(next.metadata.thumbnailDataUrl).toBe("data:mine");
      expect(next.metadata.thumbnailForVideoId).toBe("MINE");
      expect(next.metadata.duration).toBe(200);
      expect(next.metadata.title).toBe("");
    });
  });
});
