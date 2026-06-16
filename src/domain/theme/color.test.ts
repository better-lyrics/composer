/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, isHexColor, lighten, relativeLuminance, rgbToHex } from "./color";

describe("hexToRgb", () => {
  it("parses 6-digit hex with leading #", () => {
    expect(hexToRgb("#818cf8")).toEqual([129, 140, 248]);
  });

  it("parses 6-digit hex without leading #", () => {
    expect(hexToRgb("818cf8")).toEqual([129, 140, 248]);
  });

  it("parses 3-digit shorthand hex (with #)", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("parses 3-digit shorthand hex (without #)", () => {
    expect(hexToRgb("f00")).toEqual([255, 0, 0]);
  });

  it("parses pure black and white", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("expands each shorthand digit by duplication", () => {
    expect(hexToRgb("#abc")).toEqual([0xaa, 0xbb, 0xcc]);
  });
});

describe("rgbToHex", () => {
  it("round-trips a known color", () => {
    expect(rgbToHex(129, 140, 248)).toBe("#818cf8");
  });

  it("pads single-digit channels with a leading zero", () => {
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(1, 2, 3)).toBe("#010203");
  });

  it("clamps values above 255 down to ff", () => {
    expect(rgbToHex(300, 999, 256)).toBe("#ffffff");
  });

  it("clamps negative values up to 00", () => {
    expect(rgbToHex(-5, -1, -1000)).toBe("#000000");
  });

  it("rounds fractional channel values", () => {
    expect(rgbToHex(0.4, 0.6, 254.5)).toBe("#0001ff");
  });
});

describe("lighten", () => {
  it("moves toward white for positive amounts", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#000000", 1)).toBe("#ffffff");
  });

  it("moves toward black for negative amounts", () => {
    expect(lighten("#ffffff", -0.5)).toBe("#808080");
    expect(lighten("#ffffff", -1)).toBe("#000000");
  });

  it("is identity at amount 0 (normalized form)", () => {
    expect(lighten("#818cf8", 0)).toBe("#818cf8");
  });

  it("clamps so a fully lightened color never exceeds white", () => {
    expect(lighten("#ffffff", 1)).toBe("#ffffff");
  });
});

describe("relativeLuminance", () => {
  it("is approximately 0 for black", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
  });

  it("is approximately 1 for white", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("weights green more than red and blue", () => {
    const red = relativeLuminance([255, 0, 0]);
    const green = relativeLuminance([0, 255, 0]);
    const blue = relativeLuminance([0, 0, 255]);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("is exactly 21 for black vs white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("is exactly 1 for identical colors", () => {
    expect(contrastRatio("#818cf8", "#818cf8")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#000000")).toBeCloseTo(1, 5);
  });
});

describe("isHexColor", () => {
  it("accepts 6-digit hex with leading #", () => {
    expect(isHexColor("#818cf8")).toBe(true);
    expect(isHexColor("#000000")).toBe(true);
    expect(isHexColor("#FFFFFF")).toBe(true);
  });

  it("accepts 3-digit shorthand hex with leading #", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#0Ab")).toBe(true);
  });

  it("requires the leading #", () => {
    expect(isHexColor("818cf8")).toBe(false);
    expect(isHexColor("fff")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isHexColor("#zzzzzz")).toBe(false);
    expect(isHexColor("#12345g")).toBe(false);
  });

  it("rejects wrong-length values", () => {
    expect(isHexColor("#ffff")).toBe(false);
    expect(isHexColor("#fffff")).toBe(false);
    expect(isHexColor("#fffffff")).toBe(false);
    expect(isHexColor("#")).toBe(false);
  });

  it("rejects empty and whitespace strings", () => {
    expect(isHexColor("")).toBe(false);
    expect(isHexColor("   ")).toBe(false);
    expect(isHexColor("# fff")).toBe(false);
  });

  it("rejects CSS-injection-shaped payloads", () => {
    expect(isHexColor("red;}body{display:none")).toBe(false);
    expect(isHexColor("#fff;color:red")).toBe(false);
  });
});

describe("invariants", () => {
  it("lighten by 0 is the identity (normalized)", () => {
    for (const hex of ["#818cf8", "#28292c", "#ffe5e5", "#000000", "#ffffff"]) {
      expect(lighten(hex, 0)).toBe(rgbToHex(...hexToRgb(hex)));
    }
  });

  it("contrastRatio is symmetric", () => {
    const pairs: Array<[string, string]> = [
      ["#28292c", "#ffffff"],
      ["#818cf8", "#1a1a1c"],
      ["#f7f7f8", "#1b1c1f"],
    ];
    for (const [a, b] of pairs) {
      expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
    }
  });

  it("hexToRgb then rgbToHex round-trips 6-digit hex", () => {
    for (const hex of ["#818cf8", "#28292c", "#ff7a85", "#696b77"]) {
      expect(rgbToHex(...hexToRgb(hex))).toBe(hex);
    }
  });
});
