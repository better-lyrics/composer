/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { decodeThemeCode, encodeThemeCode, SEED_CODE_ORDER } from "./code";
import { type Theme, SEED_TOKENS } from "./model";
import { PRESETS } from "./presets";

let counter = 0;
const makeId = () => `test-id-${counter++}`;

// The Default preset's share code as emitted by Composer 1.37.x, before the
// positive/negative seeds existed. Any wire-order change breaks this fixture.
const LEGACY_DEFAULT_CODE =
  "ctm1:dark:Default:28292c,1a1a1c,3e3e41,ffffff,aaaaaa,696b77,818cf8,d4a5a5,5865f2,b45555,ffe5e5,f5a623,ff7a85,737476,ffd66b,4fd6c0";

describe("wire format compatibility", () => {
  it("regression: a 1.37.x share code still maps every seed to the token it was written for", () => {
    const decoded = decodeThemeCode(LEGACY_DEFAULT_CODE, makeId);
    expect(decoded.tokens.bg).toBe("#28292c");
    expect(decoded.tokens.explicit).toBe("#ff7a85");
    expect(decoded.tokens.wave).toBe("#737476");
    expect(decoded.tokens.snap).toBe("#ffd66b");
    expect(decoded.tokens.onset).toBe("#4fd6c0");
  });

  it("regression: seeds added after 1.37.x stay unset when decoding a legacy code", () => {
    const decoded = decodeThemeCode(LEGACY_DEFAULT_CODE, makeId);
    expect(decoded.tokens.positive).toBeUndefined();
    expect(decoded.tokens.negative).toBeUndefined();
  });

  it("pins the first sixteen wire slots to the 1.37.x order", () => {
    expect(SEED_CODE_ORDER.slice(0, 16)).toEqual([
      "bg",
      "bg-dark",
      "bg-elevated",
      "text",
      "text-tertiary",
      "text-faint",
      "accent",
      "accent-warm",
      "link",
      "error",
      "error-text",
      "warning",
      "explicit",
      "wave",
      "snap",
      "onset",
    ]);
  });

  it("covers every seed token, so no seed is unshareable", () => {
    expect([...SEED_CODE_ORDER].sort()).toEqual([...SEED_TOKENS].sort());
  });

  it("has no duplicate slots", () => {
    expect(new Set(SEED_CODE_ORDER).size).toBe(SEED_CODE_ORDER.length);
  });

  it("encodes into the wire order, not the display order", () => {
    const code = encodeThemeCode(PRESETS[0]);
    const hexes = code.split(":")[3].split(",");
    SEED_CODE_ORDER.forEach((key, index) => {
      expect(`#${hexes[index]}`.toLowerCase()).toBe(PRESETS[0].tokens[key]?.toLowerCase());
    });
  });
});

describe("encodeThemeCode", () => {
  it("emits the ctm1 envelope with scheme, encoded name, and seed hexes", () => {
    const theme: Theme = {
      id: "x",
      name: "My Theme",
      kind: "custom",
      scheme: "dark",
      tokens: Object.fromEntries(SEED_TOKENS.map((k, i) => [k, `#${(i + 16).toString(16).padStart(2, "0")}0000`])),
    };
    const code = encodeThemeCode(theme);
    expect(code.startsWith("ctm1:dark:My%20Theme:")).toBe(true);
    const seeds = code.split(":")[3].split(",");
    expect(seeds).toHaveLength(SEED_TOKENS.length);
    expect(seeds.every((s) => !s.includes("#"))).toBe(true);
  });

  it("strips the leading # from every seed hex", () => {
    const code = encodeThemeCode(PRESETS[0]);
    const seeds = code.split(":")[3].split(",");
    expect(seeds[0]).toBe("28292c");
  });
});

describe("round-trip", () => {
  it("decode(encode(preset)) preserves seeds, name, and scheme for every preset", () => {
    for (const preset of PRESETS) {
      const decoded = decodeThemeCode(encodeThemeCode(preset), makeId);
      expect(decoded.scheme).toBe(preset.scheme);
      expect(decoded.name).toBe(preset.name);
      for (const key of SEED_TOKENS) {
        expect(decoded.tokens[key]?.toLowerCase()).toBe(preset.tokens[key]?.toLowerCase());
      }
    }
  });

  it("decoded theme is always kind custom", () => {
    for (const preset of PRESETS) {
      const decoded = decodeThemeCode(encodeThemeCode(preset), makeId);
      expect(decoded.kind).toBe("custom");
    }
  });

  it("decoded theme does not carry shade/alpha tokens (only seeds)", () => {
    const decoded = decodeThemeCode(encodeThemeCode(PRESETS[0]), makeId);
    expect(decoded.tokens["accent-dark"]).toBeUndefined();
    expect(decoded.tokens.border).toBeUndefined();
  });
});

describe("id injection", () => {
  it("uses the injected id factory deterministically", () => {
    let n = 0;
    const id = decodeThemeCode("ctm1:dark:Name:280000", () => `fixed-${n++}`).id;
    expect(id).toBe("fixed-0");
  });

  it("does not reuse the source preset id", () => {
    const decoded = decodeThemeCode(encodeThemeCode(PRESETS[0]), () => "fresh");
    expect(decoded.id).toBe("fresh");
    expect(decoded.id).not.toBe(PRESETS[0].id);
  });
});

describe("name encoding", () => {
  it("survives spaces", () => {
    const theme: Theme = {
      id: "x",
      name: "Sunset Over Bay",
      kind: "custom",
      scheme: "light",
      tokens: { bg: "#ffffff" },
    };
    expect(decodeThemeCode(encodeThemeCode(theme), makeId).name).toBe("Sunset Over Bay");
  });

  it("survives unicode and punctuation", () => {
    const theme: Theme = {
      id: "x",
      name: "Rosé Pine :: 夜",
      kind: "custom",
      scheme: "dark",
      tokens: { bg: "#191724" },
    };
    expect(decodeThemeCode(encodeThemeCode(theme), makeId).name).toBe("Rosé Pine :: 夜");
  });
});

describe("malformed input throws", () => {
  it("rejects an unrelated string", () => {
    expect(() => decodeThemeCode("abc", makeId)).toThrow();
  });

  it("rejects a wrong version prefix", () => {
    expect(() => decodeThemeCode("ctm0:dark:x:aaa", makeId)).toThrow();
  });

  it("rejects an invalid scheme", () => {
    expect(() => decodeThemeCode("ctm1:sepia:x:aaa", makeId)).toThrow();
  });

  it("rejects missing segments", () => {
    expect(() => decodeThemeCode("ctm1:dark", makeId)).toThrow();
    expect(() => decodeThemeCode("ctm1:dark:name", makeId)).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => decodeThemeCode("", makeId)).toThrow();
  });

  it("throws an Error with a message", () => {
    try {
      decodeThemeCode("abc", makeId);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message.length).toBeGreaterThan(0);
    }
  });
});

describe("edge cases", () => {
  it("trims surrounding whitespace before decoding", () => {
    const decoded = decodeThemeCode("  ctm1:dark:Name:280000  ", makeId);
    expect(decoded.scheme).toBe("dark");
    expect(decoded.tokens.bg).toBe("#280000");
  });

  it("falls back to a default name when the name segment is empty", () => {
    const decoded = decodeThemeCode("ctm1:dark::280000", makeId);
    expect(decoded.name.length).toBeGreaterThan(0);
  });

  it("only maps as many seeds as are present in the code", () => {
    const decoded = decodeThemeCode("ctm1:dark:Partial:280000,1a1a1c", makeId);
    expect(decoded.tokens[SEED_CODE_ORDER[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_CODE_ORDER[1]]).toBe("#1a1a1c");
    expect(decoded.tokens[SEED_CODE_ORDER[2]]).toBeUndefined();
  });
});

describe("invalid hex seeds are skipped, not assigned", () => {
  it("drops a non-hex seed value", () => {
    const decoded = decodeThemeCode("ctm1:dark:Bad:zzzzzz", makeId);
    expect(decoded.tokens[SEED_CODE_ORDER[0]]).toBeUndefined();
  });

  it("keeps valid seeds and drops only the invalid ones", () => {
    const decoded = decodeThemeCode("ctm1:dark:Mixed:280000,zzzzzz,1a1a1c", makeId);
    expect(decoded.tokens[SEED_CODE_ORDER[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_CODE_ORDER[1]]).toBeUndefined();
    expect(decoded.tokens[SEED_CODE_ORDER[2]]).toBe("#1a1a1c");
  });

  it("skips empty inter-comma slots", () => {
    const decoded = decodeThemeCode("ctm1:dark:Gaps:280000,,1a1a1c", makeId);
    expect(decoded.tokens[SEED_CODE_ORDER[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_CODE_ORDER[1]]).toBeUndefined();
    expect(decoded.tokens[SEED_CODE_ORDER[2]]).toBe("#1a1a1c");
  });

  it("drops wrong-length hex values", () => {
    const decoded = decodeThemeCode("ctm1:dark:Short:2800,1a1a1c", makeId);
    expect(decoded.tokens[SEED_CODE_ORDER[0]]).toBeUndefined();
    expect(decoded.tokens[SEED_CODE_ORDER[1]]).toBe("#1a1a1c");
  });

  it("does not let CSS-injection-shaped payloads through", () => {
    const decoded = decodeThemeCode("ctm1:dark:Evil:red;}body{display:none", makeId);
    for (const key of SEED_TOKENS) {
      expect(decoded.tokens[key]).toBeUndefined();
    }
  });

  it("regression: clean round-trip still preserves every seed", () => {
    const decoded = decodeThemeCode(encodeThemeCode(PRESETS[0]), makeId);
    for (const key of SEED_TOKENS) {
      expect(decoded.tokens[key]?.toLowerCase()).toBe(PRESETS[0].tokens[key]?.toLowerCase());
    }
  });
});
