import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "insync/agent-colors";
import { agentsAfterImport } from "insync/agent-imported-agents";
import { lineText } from "insync/line-text";
import { mainTrack, timedSyllables } from "insync/line-track";
import { mainTimingWrite } from "insync/line-track-writes";
import { normalizeLoadedMetadata } from "insync/project-normalize-metadata";
import edgeCasesTtml from "@/test/fixtures/ttml/edge-cases.ttml?raw";
import { parseTtml } from "insync/ttml/read";
import { generateTTML } from "insync/ttml/write";
import { parseXmlDocument } from "@/utils/xml-document";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Helpers ------------------------------------------------------------------

function exported(): string {
  const parsed = parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER);
  return generateTTML({
    metadata: normalizeLoadedMetadata(parsed.metadata),
    agents: parsed.agents ?? [],
    lines: parsed.lines,
    parts: parsed.parts,
    passthrough: parsed.passthrough,
    splitChar: DEFAULT_SPLIT_CHARACTER,
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

  it("regression: each metadata block keeps its own attributes and elements, in source order", () => {
    const ttml = exported();
    expect(ttml).toMatch(/<metadata x-vendor:pass="first">[\s\S]*<\/metadata>\s*<metadata x-vendor:pass="second"/);
    expect(ttml).toContain(
      '<metadata x-vendor:pass="second" x-vendor:origin="desk"><x-vendor:tag>second block</x-vendor:tag></metadata>',
    );
  });

  it("a song part holding nested sections covers their lines, and an empty one is kept", () => {
    const parsed = parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER);
    const verse = parsed.parts?.find((part) => part.kind === "Verse");
    expect(verse?.lineIds).toEqual([parsed.lines[0].id, parsed.lines[1].id]);
    const ttml = exported();
    expect(ttml).toContain('itunes:songPart="Verse" x-vendor:section="outer"');
    expect(ttml).toContain('itunes:songPart="Intro"');
    expect(ttml).toContain('x-vendor:mood="hush"');
  });

  it("a singer's name is its own ttm:name; a nested one is kept once", () => {
    expect(parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER).agents?.[0].name).toBe("Ilse Marr");
    expect(occurrences(exported(), "Shade Wren")).toBe(1);
  });

  it("an element inside a line-synced line that is not lyric text stays out of the lyric and is kept", () => {
    expect(lineText(parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER).lines[2], DEFAULT_SPLIT_CHARACTER)).toBe(
      "Quiet harbour bright",
    );
    expect(exported()).toContain("<x-vendor:note>aside</x-vendor:note>");
  });

  it("regression: a kept element in the middle of a line-synced line stays between the words it sat between", () => {
    expect(exported()).toContain(
      'Quiet <x-vendor:note>aside</x-vendor:note>harbour <span tts:color="red">bright</span></p>',
    );
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

  it("regression: a prefix the source declared below the root is written with the source's namespace", () => {
    const sources = [
      `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:01.000" end="0:02.000" xmlns:v="urn:v"><span begin="0:01.000" end="0:02.000" v:x="1">Tide</span></p></div></body></tt>`,
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><body><div itunes:songPart="Verse" xmlns:v="urn:v"><p begin="0:01.000" end="0:02.000"><span begin="0:01.000" end="0:02.000" v:x="1">Tide</span></p></div></body></tt>`,
    ];
    for (const source of sources) {
      const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
      const ttml = generateTTML({
        metadata: normalizeLoadedMetadata(parsed.metadata),
        agents: [],
        lines: parsed.lines,
        parts: parsed.parts,
        passthrough: parsed.passthrough,
        splitChar: DEFAULT_SPLIT_CHARACTER,
      });
      expect(ttml).not.toContain("urn:composer:unbound:v");
      expect(ttml).toContain('xmlns:v="urn:v"');
    }
  });

  it("regression: kept line and background times are written only while they hold the content", () => {
    const write = (source: string) => {
      const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
      return generateTTML({
        metadata: normalizeLoadedMetadata(parsed.metadata),
        agents: [],
        lines: parsed.lines,
        splitChar: DEFAULT_SPLIT_CHARACTER,
      });
    };
    const backgroundPastLine = write(
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div><p begin="0:01.000" end="0:05.000"><span begin="0:01.000" end="0:03.000">Tide</span><span ttm:role="x-bg"><span begin="0:04.000" end="0:05.200">(in)</span></span></p></div></body></tt>`,
    );
    expect(backgroundPastLine).toContain('<p begin="0:01.000" end="0:05.200"');
    const backgroundAfterItsSpan = write(
      `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div><p begin="0:01.000" end="0:03.000">Low tide<span ttm:role="x-bg" begin="0:02.000">(low)</span></p></div></body></tt>`,
    );
    expect(backgroundAfterItsSpan).toContain(
      '<span ttm:role="x-bg" begin="0:01.000"><span begin="0:01.000" end="0:03.000">(low)</span></span>',
    );
  });

  it("a second round trip changes nothing", () => {
    const once = exported();
    const parsed = parseTtml(once, DEFAULT_SPLIT_CHARACTER);
    const twice = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents: parsed.agents ?? [],
      lines: parsed.lines,
      parts: parsed.parts,
      passthrough: parsed.passthrough,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    expect(twice).toBe(once);
  });

  it("a file naming the default singer keeps that singer's kept data on import", () => {
    const parsed = parseTtml(edgeCasesTtml, DEFAULT_SPLIT_CHARACTER);
    const { agents } = agentsAfterImport(DEFAULT_AGENTS, parsed.agents, parsed.lines);
    const ttml = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents,
      lines: parsed.lines,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    expect(ttml).toContain('<ttm:agent xml:id="v1" type="person" x-vendor:voice="alto">');
    expect(ttml).toContain("<x-vendor:alias><ttm:name>Shade Wren</ttm:name></x-vendor:alias>");
  });

  it("sections nested in a song part keep their own label, times, attributes and elements", () => {
    const ttml = exported();
    expect(ttml).toContain('<div begin="0:00.900" itunes:songPart="Hook" x-vendor:sub="a" z-tool:depth="2">');
    expect(ttml).toContain('<x-vendor:cue at="start"/>');
    expect(ttml).toContain('<div end="0:06.500">');
  });

  it("kept elements keep their place before the head, a section and a line", () => {
    const ttml = exported();
    expect(ttml).toMatch(/<x-vendor:preamble version="2"\/>\s*<head>/);
    expect(ttml).toMatch(/<div itunes:songPart="Intro" x-vendor:mood="hush"\/>\s*<div itunes:songPart="Verse"/);
    expect(ttml).toMatch(/<x-vendor:cue at="start"\/>\s*<p begin="0:01.000"/);
  });

  it("untimed spans of a line-synced line and background keep their attributes", () => {
    const ttml = exported();
    expect(ttml).toContain('harbour <span tts:color="red">bright</span>');
    expect(ttml).toContain(
      '<span ttm:role="x-bg"><span begin="0:10.000" end="0:12.000" x-vendor:echo="2">(far)</span></span>',
    );
  });

  it("a singer name holding an element writes its text once", () => {
    const ttml = exported();
    expect(ttml).toContain("<ttm:name>Juno <x-vendor:nick>JP</x-vendor:nick></ttm:name>");
    expect(occurrences(ttml, "JP")).toBe(1);
  });

  it("a prefix used only inside a nested section is declared", () => {
    const ttml = exported();
    expect(ttml).toContain('z-tool:depth="2"');
    expect(ttml).toContain('xmlns:z-tool="urn:composer:unbound:z-tool"');
  });

  it("a line-synced line and its background write their untimed span back with its attribute", () => {
    const source = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling"><head><metadata/></head><body><div><p begin="0:01.000" end="0:03.000"><span tts:color="red">Hello</span> world<span ttm:role="x-bg"><span tts:color="red">Hello</span> world</span></p></div></body></tt>`;
    const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
    const ttml = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents: [],
      lines: parsed.lines,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    expect(ttml).toContain('ttm:agent="v1"><span tts:color="red">Hello</span> world<span ttm:role="x-bg">');
    expect(ttml).toContain(
      '<span ttm:role="x-bg"><span begin="0:01.000" end="0:03.000"><span tts:color="red">Hello</span> world</span></span>',
    );
  });

  it("regression: a kept element stays after the syllable it followed when an earlier one is deleted", () => {
    const source = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:k="https://vendor.example/k"><body><div><p begin="0:01.000" end="0:04.000"><span begin="0:01.000" end="0:02.000">Tide </span><span begin="0:02.000" end="0:03.000">comes </span><k:mark/><span begin="0:03.000" end="0:04.000">in</span></p></div></body></tt>`;
    const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
    const [line] = parsed.lines;
    const edited = { ...line, ...mainTimingWrite(line, timedSyllables(mainTrack(line)).slice(1)) };
    const ttml = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents: [],
      lines: [edited],
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    expect(ttml).toMatch(/>comes<\/span> <k:mark\/><span [^>]*>in<\/span><\/p>/);
  });

  it("regression: a body element between two plain sections stays between their lines", () => {
    const source = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:k="https://vendor.example/k"><body><div><p begin="0:01.000" end="0:02.000">Low tide</p></div><k:break/><div><p begin="0:03.000" end="0:04.000">High tide</p></div></body></tt>`;
    const parsed = parseTtml(source, DEFAULT_SPLIT_CHARACTER);
    const ttml = generateTTML({
      metadata: normalizeLoadedMetadata(parsed.metadata),
      agents: [],
      lines: parsed.lines,
      passthrough: parsed.passthrough,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    expect(ttml).toMatch(/Low tide<\/p>\s*<\/div>\s*<k:break\/>\s*<div>\s*<p [^>]*>High tide/);
  });
});
