import { TOKEN_VAR } from "@/domain/theme/model";
import { codeHighlightThemeFor } from "@/utils/theme/code-highlight-theme";
import { themes } from "prism-react-renderer";
import { describe, expect, it } from "vitest";

const codeHighlightTheme = codeHighlightThemeFor("light");

// -- Helpers ------------------------------------------------------------------

function colorsOf(entry: { color?: string; background?: string; backgroundColor?: string }): string[] {
  return [entry.color, entry.background, entry.backgroundColor].filter((value) => value !== undefined);
}

function colorFor(type: string): string | undefined {
  return codeHighlightTheme.styles.find((style) => style.types.includes(type))?.style.color;
}

// -- Tests --------------------------------------------------------------------

describe("codeHighlightThemeFor light", () => {
  it("uses only composer theme variables, so it follows the active theme", () => {
    const colors = [
      ...colorsOf(codeHighlightTheme.plain),
      ...codeHighlightTheme.styles.flatMap((s) => colorsOf(s.style)),
    ];
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect(color).toMatch(/^var\(--color-composer-[a-z-]+\)$/);
  });

  it("references only variables the theme model defines", () => {
    const known = new Set(Object.values(TOKEN_VAR).map((name) => `var(${name})`));
    const colors = [
      ...colorsOf(codeHighlightTheme.plain),
      ...codeHighlightTheme.styles.flatMap((s) => colorsOf(s.style)),
    ];
    for (const color of colors) expect(known.has(color)).toBe(true);
  });

  it("draws plain text and the background from the text and elevated background tokens", () => {
    expect(codeHighlightTheme.plain.color).toBe(`var(${TOKEN_VAR.text})`);
    expect(codeHighlightTheme.plain.backgroundColor).toBe(`var(${TOKEN_VAR["bg-elevated"]})`);
  });

  it("maps each XML token kind to its theme token", () => {
    expect(colorFor("tag")).toBe(`var(${TOKEN_VAR["accent-text"]})`);
    expect(colorFor("attr-name")).toBe(`var(${TOKEN_VAR.link})`);
    expect(colorFor("attr-value")).toBe(`var(${TOKEN_VAR.positive})`);
    expect(colorFor("string")).toBe(`var(${TOKEN_VAR.positive})`);
    expect(colorFor("comment")).toBe(`var(${TOKEN_VAR["text-muted"]})`);
    expect(colorFor("prolog")).toBe(`var(${TOKEN_VAR["text-muted"]})`);
    expect(colorFor("punctuation")).toBe(`var(${TOKEN_VAR["text-secondary"]})`);
  });
});

describe("codeHighlightThemeFor dark", () => {
  const dark = codeHighlightThemeFor("dark");

  it("keeps the night owl token colours", () => {
    expect(dark.styles).toBe(themes.nightOwl.styles);
    expect(dark.plain.color).toBe(themes.nightOwl.plain.color);
  });

  it("draws the background from the elevated background token", () => {
    expect(dark.plain.backgroundColor).toBe(`var(${TOKEN_VAR["bg-elevated"]})`);
  });

  describe("invariants", () => {
    it("does not modify the shared night owl theme", () => {
      expect(themes.nightOwl.plain.backgroundColor).not.toBe(`var(${TOKEN_VAR["bg-elevated"]})`);
    });
  });
});
