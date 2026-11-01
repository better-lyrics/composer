import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";
import { canonicalLineKeys, lineKeyIds, renumberLineKeys } from "@/utils/ttml-line-keys";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };

function translated(id: string, text: string, begin: number) {
  return {
    ...createLine({ id, text, begin, end: begin + 1 }),
    translations: { es: { language: "es", text: `${text} es`, origin: "manual" as const, sourceFingerprint: "fp" } },
  };
}

const ALPHA = translated("a", "Alpha", 1);
const BRAVO = translated("b", "Bravo", 2);
const CHARLIE = translated("c", "Charlie", 3);

function exported(lines: Parameters<typeof generateTTML>[0]["lines"]): string {
  return generateTTML({ metadata: METADATA, agents: [], lines });
}

function keysIn(ttml: string): string[] {
  return [...ttml.matchAll(/itunes:key=["']([^"']+)["']/g)].map((match) => match[1] ?? "");
}

// -- Tests --------------------------------------------------------------------

describe("lineKeyIds", () => {
  it("maps each key the export writes to its line id", () => {
    const blank = createLine({ id: "blank", text: "" });
    expect(lineKeyIds([ALPHA, blank, BRAVO])).toEqual({ L1: "a", L2: "b" });
  });

  it("is empty for a project the export writes no line for", () => {
    expect(lineKeyIds([createLine({ id: "x", text: "Untimed" })])).toEqual({});
  });
});

describe("renumberLineKeys", () => {
  it("moves the keys and their references from one numbering to another", () => {
    const content = exported([ALPHA, BRAVO, CHARLIE]).replace(">Charlie<", ">Charlie!<");
    const renumbered = renumberLineKeys(content, lineKeyIds([ALPHA, BRAVO, CHARLIE]), lineKeyIds([ALPHA, CHARLIE]));
    expect(keysIn(renumbered)).toEqual(["L1", "N1", "L2"]);
    expect(renumbered).toContain('<text for="L2">Charlie es</text>');
    expect(renumbered).toContain('<text for="N1">Bravo es</text>');
    expect(canonicalLineKeys(renumbered)).toBe(canonicalLineKeys(content));
  });

  describe("edge cases", () => {
    it("gives a key the old numbering never had a fresh key", () => {
      const content = exported([ALPHA]).replace('itunes:key="L1"', 'itunes:key="L7"');
      expect(keysIn(renumberLineKeys(content, { L1: "a" }, { L1: "a" }))).toEqual(["N1"]);
    });

    it("keeps a repeated key shared by its paragraphs", () => {
      const original = exported([ALPHA]);
      const paragraph = original.match(/<p [^>]*>[\s\S]*?<\/p>/)?.[0] ?? "";
      const content = original.replace(paragraph, `${paragraph}${paragraph}`);
      expect(keysIn(renumberLineKeys(content, { L1: "a" }, { L3: "a" }))).toEqual(["L3", "L3"]);
    });

    it("keeps single quotes", () => {
      const content = exported([ALPHA]).replace('itunes:key="L1"', "itunes:key='L1'");
      expect(renumberLineKeys(content, { L1: "a" }, { L2: "a" })).toContain("itunes:key='L2'");
    });
  });

  describe("invariants", () => {
    it("changes nothing when both numberings are the same", () => {
      const content = exported([ALPHA, BRAVO]);
      const keys = lineKeyIds([ALPHA, BRAVO]);
      expect(renumberLineKeys(content, keys, keys)).toBe(content);
    });
  });
});
