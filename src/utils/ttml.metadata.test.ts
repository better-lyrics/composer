import { describe, expect, it } from "vitest";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";

const metadata: ProjectMetadata = {
  title: "Song & Dance",
  artists: ['A "Q" B', "Kali Uchis"],
  album: "Flower Boy",
  duration: 0,
  isrc: "USQX91700001",
  songwriters: ["W1"],
  extra: { spotifyId: "abc" },
};
const lines = [{ id: "l1", text: "hi", begin: 1, end: 2, agentId: "v1" }];

describe("generateTTML metadata", () => {
  const ttml = generateTTML({ metadata, agents: [], lines });
  it("keeps the title in ttm:title", () => expect(ttml).toContain("<ttm:title>Song &amp; Dance</ttm:title>"));
  it("emits one composer:meta per artist", () => {
    expect(ttml).toContain('<composer:meta key="artists" value="Kali Uchis"/>');
  });
  it("escapes quotes inside attribute values", () => {
    expect(ttml).toContain('<composer:meta key="artists" value="A &quot;Q&quot; B"/>');
  });
  it("emits album, isrc, songwriter, extra", () => {
    expect(ttml).toContain('<composer:meta key="album" value="Flower Boy"/>');
    expect(ttml).toContain('<composer:meta key="isrc" value="USQX91700001"/>');
    expect(ttml).toContain('<composer:meta key="songwriter" value="W1"/>');
    expect(ttml).toContain('<composer:meta key="spotifyId" value="abc"/>');
  });
  it("emits no composer:meta when there is no extended metadata", () => {
    const bare = generateTTML({
      metadata: { title: "x", artists: [], album: "", duration: 0 },
      agents: [],
      lines,
    });
    expect(bare).not.toContain("composer:meta");
  });
});

describe("generateTTML xml:lang", () => {
  const bare: ProjectMetadata = { title: "t", artists: [], album: "", duration: 0 };
  const generate = (language?: string) => generateTTML({ metadata: { ...bare, language }, agents: [], lines });
  const rootOf = (xml: string) => new DOMParser().parseFromString(xml, "application/xml").documentElement;

  it("omits xml:lang when no language is set", () => {
    expect(rootOf(generate()).hasAttribute("xml:lang")).toBe(false);
  });

  it("emits the language when set", () => {
    expect(rootOf(generate("ja")).getAttribute("xml:lang")).toBe("ja");
  });

  it("keeps a region subtag intact", () => {
    expect(rootOf(generate("pt-BR")).getAttribute("xml:lang")).toBe("pt-BR");
  });

  describe("edge cases", () => {
    it("omits xml:lang when the language is an empty string", () => {
      expect(rootOf(generate("")).hasAttribute("xml:lang")).toBe(false);
    });

    it("omits xml:lang when the language is whitespace only", () => {
      expect(rootOf(generate("   ")).hasAttribute("xml:lang")).toBe(false);
    });

    it("trims surrounding whitespace off the emitted language", () => {
      expect(rootOf(generate("  ja  ")).getAttribute("xml:lang")).toBe("ja");
    });

    it("emits the canonical form of a tag", () => {
      expect(rootOf(generate("EN-us")).getAttribute("xml:lang")).toBe("en-US");
    });

    it("omits xml:lang for a tag that is not BCP-47", () => {
      expect(rootOf(generate("not a lang!!")).hasAttribute("xml:lang")).toBe(false);
    });
  });

  describe("U9 language validation", () => {
    const agents = [{ id: "v1", type: "person" as const, name: "Lead" }];
    const wordLine = {
      id: "a",
      text: "Hello world",
      agentId: "v1",
      words: [
        { text: "Hello ", begin: 1, end: 1.5 },
        { text: "world", begin: 1.5, end: 2 },
      ],
    };

    it("does not export an invalid BCP-47 tag as xml:lang", () => {
      const ttml = generateTTML({
        metadata: { ...bare, language: "not a lang!!" },
        agents,
        lines: [wordLine],
      });
      expect(ttml).not.toContain('xml:lang="not a lang!!"');
    });
  });

  describe("invariants", () => {
    it("leaves no double space in the tt tag when the language is absent", () => {
      expect(generate().split("\n")[0]).not.toContain("  ");
    });

    it("stays well-formed with the attribute omitted", () => {
      expect(new DOMParser().parseFromString(generate(), "application/xml").querySelector("parsererror")).toBeNull();
    });

    it("keeps the other tt attributes when the language is absent", () => {
      const xml = generate();
      expect(xml).toContain('ttp:timeBase="media"');
      expect(xml).toContain('itunes:timing="Line"');
      expect(xml).toContain('composer:timing="Line"');
    });
  });
});

describe("generateTTML attribute escaping", () => {
  function parse(xml: string): Document {
    return new DOMParser().parseFromString(xml, "application/xml");
  }

  it("regression: a group label containing quotes stays well-formed", () => {
    const xml = generateTTML({
      metadata: { title: "t", artists: [], album: "", duration: 0 },
      agents: [],
      lines,
      groups: [{ id: "g1", label: 'The "Big" Chorus', color: "#fff", templateVersion: 1 }],
    });

    expect(xml).toContain('label="The &quot;Big&quot; Chorus"');
    expect(parse(xml).querySelector("parsererror")).toBeNull();
  });

  it("regression: an agent name and id containing quotes stay well-formed", () => {
    const xml = generateTTML({
      metadata: { title: "t", artists: [], album: "", duration: 0 },
      agents: [{ id: 'v"1', type: "person", name: 'The "Lead"' }],
      lines,
    });

    expect(xml).toContain('xml:id="v&quot;1"');
    expect(parse(xml).querySelector("parsererror")).toBeNull();
  });

  it("regression: a language tag containing quotes stays well-formed", () => {
    const xml = generateTTML({
      metadata: { title: "t", artists: [], album: "", duration: 0, language: 'en"US' },
      agents: [],
      lines,
    });

    expect(xml).not.toContain("xml:lang=");
    expect(parse(xml).querySelector("parsererror")).toBeNull();
  });
});
