import { describe, expect, it } from "vitest";
import type { SongDetails } from "@/domain/musicbrainz/song-details";
import { fillPatch, metadataSuggestions, suggestionCount } from "@/domain/musicbrainz/suggestion";
import type { ProjectMetadata } from "@/domain/project/metadata";

const details: SongDetails = {
  recordingId: "r",
  title: "Your Power",
  album: "Happier Than Ever",
  isrc: "USUM72105934",
  artists: ["Billie Eilish"],
  songwriters: ["Billie Eilish", "FINNEAS"],
  coverReleaseGroupId: null,
  releaseYear: "2021",
  lengthSec: 245.9,
};

const metadata = (patch: Partial<ProjectMetadata> = {}): ProjectMetadata => ({
  title: "Your Power",
  artists: [],
  album: "",
  duration: 0,
  ...patch,
});

describe("metadataSuggestions", () => {
  it("fills every empty field", () => {
    expect(metadataSuggestions(details, metadata())).toEqual({
      album: { kind: "fill", value: "Happier Than Ever" },
      isrc: { kind: "fill", value: "USUM72105934" },
      artists: { kind: "fill", value: ["Billie Eilish"] },
      songwriters: { kind: "fill", value: ["Billie Eilish", "FINNEAS"] },
    });
  });

  it("offers a different value without filling it", () => {
    const suggestions = metadataSuggestions(details, metadata({ album: "Other" }));
    expect(suggestions.album).toEqual({ kind: "differs", value: "Happier Than Ever" });
    expect(fillPatch(suggestions, metadata({ album: "Other" })).album).toBeUndefined();
  });

  describe("edge cases", () => {
    it("treats case and spacing changes as the same value", () => {
      expect(metadataSuggestions(details, metadata({ artists: ["billie  eilish "] })).artists).toBeUndefined();
    });

    it("compares ISRCs after normalising", () => {
      expect(metadataSuggestions(details, metadata({ isrc: "us-um7-21-05934" })).isrc).toBeUndefined();
    });

    it("skips values MusicBrainz does not have", () => {
      const sparse: SongDetails = { ...details, album: null, isrc: null, artists: [], songwriters: [] };
      expect(metadataSuggestions(sparse, metadata())).toEqual({});
    });

    it("treats a list of blank rows as empty", () => {
      expect(metadataSuggestions(details, metadata({ songwriters: [" "] })).songwriters?.kind).toBe("fill");
    });

    it("offers a different list when it holds a name MusicBrainz does not", () => {
      expect(metadataSuggestions(details, metadata({ songwriters: ["FINNEAS", "Someone Else"] })).songwriters).toEqual({
        kind: "differs",
        value: ["Billie Eilish", "FINNEAS"],
      });
    });

    it("treats the same names in another order as the same list", () => {
      expect(
        metadataSuggestions(details, metadata({ songwriters: ["finneas", "Billie Eilish"] })).songwriters,
      ).toBeUndefined();
    });
  });

  describe("regressions", () => {
    it("regression: keeps offering the remaining names after one is used", () => {
      const partial = metadata({ songwriters: ["Billie Eilish"] });
      const suggestions = metadataSuggestions(details, partial);
      expect(suggestions.songwriters).toEqual({ kind: "fill", value: ["FINNEAS"] });
      expect(fillPatch(suggestions, partial).songwriters).toEqual(["Billie Eilish", "FINNEAS"]);
    });
  });

  describe("invariants", () => {
    it("fillPatch writes only fill suggestions, and the count includes every suggestion", () => {
      const current = metadata({ album: "Other" });
      const suggestions = metadataSuggestions(details, current);
      expect(fillPatch(suggestions, current)).toEqual({
        isrc: "USUM72105934",
        artists: ["Billie Eilish"],
        songwriters: ["Billie Eilish", "FINNEAS"],
      });
      expect(suggestionCount(suggestions)).toBe(4);
    });

    it("suggests nothing once the fill has been applied", () => {
      const before = metadata();
      const after = { ...before, ...fillPatch(metadataSuggestions(details, before), before) };
      expect(metadataSuggestions(details, after)).toEqual({});
    });
  });
});
