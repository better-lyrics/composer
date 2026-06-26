import { describe, expect, it } from "vitest";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";

const metadata: ProjectMetadata = {
  title: "Song",
  artists: ["Tyler, The Creator", "Kali Uchis"],
  album: "Flower Boy",
  duration: 0,
  isrc: "USQX91700001",
  songwriters: ["W1"],
  extra: { spotifyId: "abc" },
};
const lines = [{ id: "l1", text: "hi", begin: 1, end: 2, agentId: "v1" }];

describe("parseTtml metadata round-trip", () => {
  const ttml = generateTTML({ metadata, agents: [], lines, granularity: "line" });
  const parsed = parseTtml(ttml).metadata;
  it("recovers title from ttm:title", () => expect(parsed.title).toBe("Song"));
  it("recovers all artists including comma names", () => {
    expect(parsed.artists).toEqual(["Tyler, The Creator", "Kali Uchis"]);
  });
  it("recovers album/isrc/songwriters/extra", () => {
    expect(parsed.album).toBe("Flower Boy");
    expect(parsed.isrc).toBe("USQX91700001");
    expect(parsed.songwriters).toEqual(["W1"]);
    expect(parsed.extra).toEqual({ spotifyId: "abc" });
  });
  it("still reads the legacy [type=artist] fallback when no composer:meta", () => {
    const legacy =
      '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:name type="artist">Legacy Artist</ttm:name></metadata></head><body><div><p begin="1" end="2" ttm:agent="v1">hi</p></div></body></tt>';
    expect(parseTtml(legacy).metadata.artists).toEqual(["Legacy Artist"]);
  });
  it("round-trips XML-special characters in metadata values", () => {
    const special: ProjectMetadata = {
      title: "T",
      artists: ["Tom & Jerry", 'A "Q" B'],
      album: "a < b",
      duration: 0,
      extra: { url: "x<y&z" },
    };
    const out = parseTtml(generateTTML({ metadata: special, agents: [], lines, granularity: "line" })).metadata;
    expect(out.artists).toEqual(["Tom & Jerry", 'A "Q" B']);
    expect(out.album).toBe("a < b");
    expect(out.extra).toEqual({ url: "x<y&z" });
  });
  it("parses composer:meta and dedupes artists when the composer namespace is undeclared", () => {
    const undeclared =
      '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">' +
      "<head><metadata>" +
      '<ttm:agent type="person" xml:id="v1"/>' +
      '<composer:meta key="artists" value="A"/>' +
      '<composer:meta key="artists" value="B"/>' +
      '<composer:meta key="album" value="Al"/>' +
      "</metadata></head>" +
      '<body><div><p begin="1" end="2" ttm:agent="v1">hi</p></div></body></tt>';
    const out = parseTtml(undeclared).metadata;
    expect(out.artists).toEqual(["A", "B"]);
    expect(out.album).toBe("Al");
  });
});
