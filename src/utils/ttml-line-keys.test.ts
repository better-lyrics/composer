import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";
import { canonicalLineKeys, keyedExportLines } from "@/utils/ttml-line-keys";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const METADATA = { title: "Song", artists: [], album: "", duration: 0 };
const SPANISH = (text: string) => ({
  es: { language: "es", text, origin: "manual" as const, sourceFingerprint: "fp" },
});

function exported(lines: Parameters<typeof generateTTML>[0]["lines"]): string {
  return generateTTML({ metadata: METADATA, agents: [], lines });
}

const ALPHA = { ...createLine({ id: "a", text: "Alpha", begin: 1, end: 2 }), translations: SPANISH("Alfa") };
const BRAVO = { ...createLine({ id: "b", text: "Bravo", begin: 2, end: 3 }), translations: SPANISH("Bravo es") };
const CHARLIE = { ...createLine({ id: "c", text: "Charlie", begin: 3, end: 4 }), translations: SPANISH("Carlos") };

// -- Tests --------------------------------------------------------------------

describe("keyedExportLines", () => {
  it("numbers the timed lines in order, skipping lines without timing", () => {
    const blank = createLine({ id: "blank", text: "" });
    expect(keyedExportLines([ALPHA, blank, BRAVO]).map(({ line, key }) => [line.id, key])).toEqual([
      ["a", "L1"],
      ["b", "L2"],
    ]);
  });
});

describe("canonicalLineKeys", () => {
  it("sees a deleted line's renumbered keys as the same document", () => {
    const edited = exported([ALPHA, BRAVO, CHARLIE])
      .replace(/\n\s*<p [^>]*itunes:key="L2"[^>]*>Bravo<\/p>/, "")
      .replace(/\n\s*<text for="L2">Bravo es<\/text>/, "");
    expect(canonicalLineKeys(edited)).toBe(canonicalLineKeys(exported([ALPHA, CHARLIE])));
  });

  it("sees reordered lines as the same document as their regenerated export", () => {
    const original = exported([ALPHA, BRAVO]);
    const [first = "", second = ""] = original.match(/<p [^>]*>[\s\S]*?<\/p>/g) ?? [];
    const edited = original.replace(first, "\u0000").replace(second, first).replace("\u0000", second);
    expect(canonicalLineKeys(edited)).toBe(canonicalLineKeys(exported([BRAVO, ALPHA])));
  });

  it("sees an added paragraph without a key as the same document as its regenerated export", () => {
    const added = createLine({ id: "n", text: "New", begin: 5, end: 6 });
    const edited = exported([ALPHA]).replace(
      "\n    </div>",
      '\n      <p begin="0:05.000" end="0:06.000" ttm:agent="v1">New</p>\n    </div>',
    );
    expect(canonicalLineKeys(edited)).toBe(canonicalLineKeys(exported([ALPHA, added])));
  });

  describe("edge cases", () => {
    it("still tells a changed text apart", () => {
      const edited = exported([ALPHA]).replace(">Alfa<", ">Alfa!<");
      expect(canonicalLineKeys(edited)).not.toBe(canonicalLineKeys(exported([ALPHA])));
    });

    it("still tells a comment apart", () => {
      const edited = exported([ALPHA]).replace("<div>", "<div><!-- note -->");
      expect(canonicalLineKeys(edited)).not.toBe(canonicalLineKeys(exported([ALPHA])));
    });

    it("leaves a document without keys as it is", () => {
      const plain = '<tt><body><div><p begin="0:01.000" end="0:02.000">One</p></div></body></tt>';
      expect(canonicalLineKeys(plain)).toBe(plain);
    });
  });

  describe("invariants", () => {
    it("is idempotent", () => {
      const once = canonicalLineKeys(exported([ALPHA, BRAVO, CHARLIE]));
      expect(canonicalLineKeys(once)).toBe(once);
    });
  });
});
