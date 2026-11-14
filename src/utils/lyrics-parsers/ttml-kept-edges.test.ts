import { describe, expect, it } from "vitest";
import { lineText } from "@/domain/line/text";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import edgeCasesTtml from "@/test/fixtures/ttml/edge-cases.ttml?raw";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";
import { parseXmlDocument } from "@/utils/xml-document";

// -- Helpers ------------------------------------------------------------------

function exported(): string {
  const parsed = parseTtml(edgeCasesTtml);
  return generateTTML({
    metadata: normalizeLoadedMetadata(parsed.metadata),
    agents: parsed.agents ?? [],
    lines: parsed.lines,
    parts: parsed.parts,
    passthrough: parsed.passthrough,
  });
}

const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

// -- Tests --------------------------------------------------------------------

// Expected output is spelled out here, apart from the modelled table the lossless test walks with.
describe("ttml kept data edges", () => {
  it("the export is well formed as written, with every prefix declared and no attribute twice", () => {
    expect(parseXmlDocument(exported()).ok).toBe(true);
  });

  it("elements kept on the root are written back", () => {
    const ttml = exported();
    expect(ttml).toContain('<x-vendor:preamble version="2"/>');
    expect(ttml).toContain("<x-vendor:trailer/>");
  });

  it("several metadata blocks keep the first value of each attribute and every element", () => {
    const ttml = exported();
    expect(occurrences(ttml, "x-vendor:pass=")).toBe(1);
    expect(ttml).toContain('x-vendor:pass="first"');
    expect(ttml).toContain('x-vendor:origin="desk"');
    expect(ttml).toContain("<x-vendor:tag>second block</x-vendor:tag>");
  });

  it("a song part holding nested sections covers their lines, and an empty one is kept", () => {
    const parsed = parseTtml(edgeCasesTtml);
    const verse = parsed.parts?.find((part) => part.kind === "Verse");
    expect(verse?.lineIds).toEqual([parsed.lines[0].id, parsed.lines[1].id]);
    const ttml = exported();
    expect(ttml).toContain('itunes:songPart="Verse" x-vendor:section="outer"');
    expect(ttml).toContain('itunes:songPart="Intro"');
    expect(ttml).toContain('x-vendor:mood="hush"');
  });

  it("a singer's name is its own ttm:name; a nested one is kept once", () => {
    expect(parseTtml(edgeCasesTtml).agents?.[0].name).toBe("Ilse Marr");
    expect(occurrences(exported(), "Shade Wren")).toBe(1);
  });

  it("an element inside a line-synced line that is not lyric text stays out of the lyric and is kept", () => {
    expect(lineText(parseTtml(edgeCasesTtml).lines[2])).toBe("Quiet harbour");
    expect(exported()).toContain("<x-vendor:note>aside</x-vendor:note>");
  });

  it("kept ruby that ends in a space is not followed by a second one", () => {
    expect(exported()).toContain("</ruby> </span><span");
  });

  it("only prefixes of kept names are declared, with the owning tool's namespace when known", () => {
    const ttml = exported();
    expect(ttml).not.toContain("xmlns:mode");
    expect(ttml).not.toContain("xmlns:b=");
    expect(ttml).toContain('xmlns:amll="http://www.example.com/ns/amll"');
    expect(ttml).toContain('xmlns:y-tool="urn:composer:unbound:y-tool"');
  });

  it("a second round trip changes nothing", () => {
    const once = exported();
    const parsed = parseTtml(once);
    const twice = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents: parsed.agents ?? [],
      lines: parsed.lines,
      parts: parsed.parts,
      passthrough: parsed.passthrough,
    });
    expect(twice).toBe(once);
  });
});
