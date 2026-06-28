import { describe, expect, it } from "vitest";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { fromComposerMeta, toComposerMeta } from "@/domain/project/metadata-ttml";

const base: ProjectMetadata = {
  title: "Song",
  artists: ["Tyler, The Creator", "Kali Uchis"],
  album: "Flower Boy",
  duration: 0,
  isrc: "USQX91700001",
  songwriters: ["Tyler Okonma"],
  extra: { spotifyId: "abc", mood: "chill" },
};

describe("toComposerMeta", () => {
  it("emits one pair per artist, plus album/isrc/songwriter/extra, never the title", () => {
    expect(toComposerMeta(base)).toEqual([
      { key: "artists", value: "Tyler, The Creator" },
      { key: "artists", value: "Kali Uchis" },
      { key: "album", value: "Flower Boy" },
      { key: "isrc", value: "USQX91700001" },
      { key: "songwriter", value: "Tyler Okonma" },
      { key: "mood", value: "chill" },
      { key: "spotifyId", value: "abc" },
    ]);
  });
  describe("edge cases", () => {
    it("omits empty fields", () => {
      expect(toComposerMeta({ title: "x", artists: [], album: "", duration: 0 })).toEqual([]);
    });
    it("sorts extra keys deterministically", () => {
      const pairs = toComposerMeta({ title: "", artists: [], album: "", duration: 0, extra: { z: "1", a: "2" } });
      expect(pairs.map((p) => p.key)).toEqual(["a", "z"]);
    });
    it("skips empty artist and songwriter entries", () => {
      const pairs = toComposerMeta({ title: "", artists: ["", "A"], album: "", duration: 0, songwriters: ["", "W"] });
      expect(pairs).toEqual([
        { key: "artists", value: "A" },
        { key: "songwriter", value: "W" },
      ]);
    });
  });
});

describe("fromComposerMeta", () => {
  it("collects known keys into typed fields and unknown keys into extra", () => {
    const out = fromComposerMeta([
      { key: "artists", value: "A" },
      { key: "artists", value: "B" },
      { key: "album", value: "Al" },
      { key: "isrc", value: "USQX91700001" },
      { key: "songwriter", value: "W1" },
      { key: "songwriters", value: "W2" },
      { key: "musicName", value: "T" },
      { key: "weird", value: "w" },
    ]);
    expect(out).toEqual({
      title: "T",
      artists: ["A", "B"],
      album: "Al",
      isrc: "USQX91700001",
      songwriters: ["W1", "W2"],
      extra: { weird: "w" },
    });
  });
  describe("edge cases", () => {
    it("returns an empty object for no pairs", () => expect(fromComposerMeta([])).toEqual({}));
    it("ignores pairs with an empty key", () => expect(fromComposerMeta([{ key: "", value: "x" }])).toEqual({}));
    it("ignores pairs with an empty value", () => {
      expect(
        fromComposerMeta([
          { key: "album", value: "" },
          { key: "spotifyId", value: "" },
        ]),
      ).toEqual({});
    });
  });
});

describe("round-trip", () => {
  it("fromComposerMeta(toComposerMeta(m)) recovers the non-title fields", () => {
    const out = fromComposerMeta(toComposerMeta(base));
    expect(out).toEqual({
      artists: ["Tyler, The Creator", "Kali Uchis"],
      album: "Flower Boy",
      isrc: "USQX91700001",
      songwriters: ["Tyler Okonma"],
      extra: { mood: "chill", spotifyId: "abc" },
    });
  });
});
