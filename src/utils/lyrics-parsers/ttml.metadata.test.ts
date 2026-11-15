import { fieldsOfLine } from "@/domain/line/line-from-fields";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { lineText } from "@/domain/line/text";
import type { ProjectMetadata } from "insync/metadata";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

const metadata: ProjectMetadata = {
  title: "Song",
  artists: ["Tyler, The Creator", "Kali Uchis"],
  album: "Flower Boy",
  duration: 0,
  isrc: "USQX91700001",
  songwriters: ["W1"],
  extra: { spotifyId: "abc" },
};
const lines = [lineFromFields({ id: "l1", text: "hi", begin: 1, end: 2, agentId: "v1" })];

describe("parseTtml metadata round-trip", () => {
  const ttml = generateTTML({ metadata, agents: [], lines });
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
    const out = parseTtml(generateTTML({ metadata: special, agents: [], lines })).metadata;
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

describe("parseTtml line timing", () => {
  it('regression: a line-timed <p begin="0"> stays timed', () => {
    const ttml =
      '<?xml version="1.0" encoding="UTF-8"?><tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div><p begin="0" end="2.5">Hello there</p></div></body></tt>';
    const [line] = parseTtml(ttml).lines;
    expect(fieldsOfLine(line)).toMatchObject({ text: "Hello there", begin: 0, end: 2.5 });
  });
});

describe("parseTtml escapes", () => {
  it("regression: backslashes in a well-formed file stay lyric text", () => {
    const ttml =
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1" end="2">Saved in C:\\new folder</p><p begin="2" end="3">He said \\"hi\\"</p></div></body></tt>';
    expect(parseTtml(ttml).lines.map(lineText)).toEqual(["Saved in C:\\new folder", 'He said \\"hi\\"']);
  });

  it("a document pasted with JSON escapes still reads", () => {
    const ttml =
      '<tt xmlns=\\"http://www.w3.org/ns/ttml\\"><body><div><p begin=\\"1\\" end=\\"2\\">Low tide</p></div></body></tt>';
    expect(parseTtml(ttml).lines.map(lineText)).toEqual(["Low tide"]);
  });
});

describe("parseTtml inline translations", () => {
  const doc = (head: string, paragraph: string) =>
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal">' +
    `<head><metadata>${head}</metadata></head><body><div>${paragraph}</div></body></tt>`;

  it("regression: an inline translation is not read as lyric text", () => {
    const [line] = parseTtml(
      doc(
        "",
        '<p begin="1" end="3" itunes:key="L1">Salt on the window<span ttm:role="x-translation" xml:lang="fr">Sel sur la fenetre</span><span ttm:role="x-roman" xml:lang="en-Latn">salt on da window</span></p>',
      ),
    ).lines;
    expect(lineText(line)).toBe("Salt on the window");
    expect(line.languages?.translations?.fr).toMatchObject({ main: { text: "Sel sur la fenetre" }, origin: "import" });
    expect(line.languages?.transliteration).toMatchObject({ language: "en-Latn", main: { text: "salt on da window" } });
  });

  it("reads a background's inline translation, and a head entry for the same line and language wins", () => {
    const head =
      '<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="de">' +
      '<text for="L1">Salz am Fenster</text></translation></translations></iTunesMetadata>';
    const [line] = parseTtml(
      doc(
        head,
        '<p begin="1" end="3" itunes:key="L1"><span begin="1" end="2">Salt </span><span begin="2" end="3">air</span>' +
          '<span ttm:role="x-translation" xml:lang="de">Inline Salz</span><span ttm:role="x-translation" xml:lang="fr">Air salin</span>' +
          '<span ttm:role="x-bg"><span begin="2" end="3">(air)</span><span ttm:role="x-translation" xml:lang="fr">(air)</span><span ttm:role="x-translation" xml:lang="de">(Luft)</span></span></p>',
      ),
    ).lines;
    expect(lineText(line)).toBe("Salt air");
    expect(line.languages?.translations?.de).toMatchObject({ main: { text: "Salz am Fenster" } });
    expect(line.languages?.translations?.de?.bg).toBeUndefined();
    expect(line.languages?.translations?.fr).toMatchObject({ main: { text: "Air salin" }, bg: { text: "(air)" } });
  });

  it("a translation without its own language takes the nearest one around it", () => {
    const source = doc("", '<p begin="1" end="3">Salt air<span ttm:role="x-translation">Aire salado</span></p>');
    const [line] = parseTtml(source.replace("<div>", '<div xml:lang="es">')).lines;
    expect(line.languages?.translations?.es?.main.text).toBe("Aire salado");
  });

  it("a second romanization language the line cannot hold is written back where it was", () => {
    const romanizations =
      '<span ttm:role="x-roman" xml:lang="ja-Latn">shio</span><span ttm:role="x-roman" xml:lang="ja-Hrkt">しお</span>';
    const parsed = parseTtml(doc("", `<p begin="1" end="3"><span begin="1" end="3">塩</span>${romanizations}</p>`));
    expect(parsed.lines[0].languages?.transliteration?.language).toBe("ja-Latn");
    const ttml = generateTTML({ metadata, agents: [], lines: parsed.lines, passthrough: parsed.passthrough });
    expect(ttml).toContain(
      '<span begin="0:01.000" end="0:03.000">塩</span><span ttm:role="x-roman" xml:lang="ja-Hrkt">しお</span></p>',
    );
    const reopened = parseTtml(ttml);
    expect(reopened.lines[0].languages?.transliteration).toMatchObject({ language: "ja-Latn", main: { text: "shio" } });
    const again = generateTTML({ metadata, agents: [], lines: reopened.lines, passthrough: reopened.passthrough });
    expect(again).toBe(ttml);
  });
});
