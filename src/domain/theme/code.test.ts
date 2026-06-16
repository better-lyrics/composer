/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { decodeThemeCode, encodeThemeCode } from "./code";
import { type Theme, SEED_TOKENS } from "./model";
import { PRESETS } from "./presets";

let counter = 0;
const makeId = () => `test-id-${counter++}`;

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
    expect(decoded.tokens[SEED_TOKENS[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_TOKENS[1]]).toBe("#1a1a1c");
    expect(decoded.tokens[SEED_TOKENS[2]]).toBeUndefined();
  });
});

describe("invalid hex seeds are skipped, not assigned", () => {
  it("drops a non-hex seed value", () => {
    const decoded = decodeThemeCode("ctm1:dark:Bad:zzzzzz", makeId);
    expect(decoded.tokens[SEED_TOKENS[0]]).toBeUndefined();
  });

  it("keeps valid seeds and drops only the invalid ones", () => {
    const decoded = decodeThemeCode("ctm1:dark:Mixed:280000,zzzzzz,1a1a1c", makeId);
    expect(decoded.tokens[SEED_TOKENS[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_TOKENS[1]]).toBeUndefined();
    expect(decoded.tokens[SEED_TOKENS[2]]).toBe("#1a1a1c");
  });

  it("skips empty inter-comma slots", () => {
    const decoded = decodeThemeCode("ctm1:dark:Gaps:280000,,1a1a1c", makeId);
    expect(decoded.tokens[SEED_TOKENS[0]]).toBe("#280000");
    expect(decoded.tokens[SEED_TOKENS[1]]).toBeUndefined();
    expect(decoded.tokens[SEED_TOKENS[2]]).toBe("#1a1a1c");
  });

  it("drops wrong-length hex values", () => {
    const decoded = decodeThemeCode("ctm1:dark:Short:2800,1a1a1c", makeId);
    expect(decoded.tokens[SEED_TOKENS[0]]).toBeUndefined();
    expect(decoded.tokens[SEED_TOKENS[1]]).toBe("#1a1a1c");
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
