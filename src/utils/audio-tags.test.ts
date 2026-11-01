import { parseBlob } from "music-metadata";
import { describe, expect, it } from "vitest";
import { audioTagsToMetadata } from "@/utils/audio-tags";

// -- Helpers ------------------------------------------------------------------

function id3v2(frames: Array<[string, string]>): Uint8Array {
  const enc = new TextEncoder();
  const body: number[] = [];
  for (const [id, text] of frames) {
    const content = [0x03, ...enc.encode(text)];
    const size = content.length;
    body.push(
      ...enc.encode(id),
      (size >> 24) & 0xff,
      (size >> 16) & 0xff,
      (size >> 8) & 0xff,
      size & 0xff,
      0,
      0,
      ...content,
    );
  }
  const synch = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
  return new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, ...synch(body.length), ...body]);
}

// -- Tests --------------------------------------------------------------------

describe("audioTagsToMetadata", () => {
  it("maps title/artist/album/isrc from real ID3 tags", async () => {
    const bytes = id3v2([
      ["TIT2", "Song"],
      ["TPE1", "Tyler, The Creator"],
      ["TALB", "Flower Boy"],
      ["TSRC", "USQX91700001"],
    ]);
    const { common } = await parseBlob(new Blob([bytes], { type: "audio/mpeg" }));
    expect(audioTagsToMetadata(common)).toEqual({
      title: "Song",
      artists: ["Tyler, The Creator"],
      album: "Flower Boy",
      isrc: "USQX91700001",
    });
  });

  describe("edge cases", () => {
    it("omits absent fields", () => expect(audioTagsToMetadata({})).toEqual({}));

    it("drops an invalid isrc", () => expect(audioTagsToMetadata({ isrc: ["nope"] })).toEqual({}));

    it("prefers common.artists over common.artist", () => {
      expect(audioTagsToMetadata({ artists: ["A", "B"], artist: "A; B" }).artists).toEqual(["A", "B"]);
    });

    it("falls back to common.artist when artists is absent", () => {
      expect(audioTagsToMetadata({ artist: "Solo" }).artists).toEqual(["Solo"]);
    });

    it("filters out empty/falsy entries in common.artists", () => {
      expect(audioTagsToMetadata({ artists: ["A", "", "B"] }).artists).toEqual(["A", "B"]);
    });

    it("omits artists when every entry is empty", () => {
      expect(audioTagsToMetadata({ artists: ["", ""] }).artists).toBeUndefined();
    });

    it("normalizes a lowercase isrc to uppercase", () => {
      expect(audioTagsToMetadata({ isrc: ["usqx91700001"] }).isrc).toBe("USQX91700001");
    });

    it("picks the first valid isrc when multiple are present", () => {
      expect(audioTagsToMetadata({ isrc: ["nope", "USQX91700001", "USQX91700002"] }).isrc).toBe("USQX91700001");
    });
  });

  describe("invariants", () => {
    it("never returns title/album when blank strings are passed", () => {
      expect(audioTagsToMetadata({ title: "", album: "" })).toEqual({});
    });

    it("does not mutate the input common object", () => {
      const common = { artists: ["A", ""], isrc: ["usqx91700001"] };
      audioTagsToMetadata(common);
      expect(common).toEqual({ artists: ["A", ""], isrc: ["usqx91700001"] });
    });
  });
});
