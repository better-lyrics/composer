/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { deriveTheme } from "./derive";
import { lighten } from "./color";
import { type Theme, TOKENS, type TokenKey } from "./model";

const SEED_KEYS: TokenKey[] = TOKENS.filter((t) => t.type === "seed").map((t) => t.key);

function seededTokens(value: string): Partial<Record<TokenKey, string>> {
  return Object.fromEntries(SEED_KEYS.map((k) => [k, value])) as Partial<Record<TokenKey, string>>;
}

function darkTheme(overrides: Partial<Record<TokenKey, string>> = {}): Theme {
  return {
    id: "t-dark",
    name: "Dark sample",
    kind: "custom",
    scheme: "dark",
    tokens: { ...seededTokens("#123456"), accent: "#818cf8", ...overrides },
  };
}

function lightTheme(overrides: Partial<Record<TokenKey, string>> = {}): Theme {
  return {
    id: "t-light",
    name: "Light sample",
    kind: "custom",
    scheme: "light",
    tokens: { ...seededTokens("#abcdef"), accent: "#5b63e0", ...overrides },
  };
}

describe("deriveTheme happy paths", () => {
  it("resolves every token for a dark theme", () => {
    const resolved = deriveTheme(darkTheme());
    for (const token of TOKENS) {
      expect(resolved[token.key]).toBeTruthy();
    }
    expect(Object.keys(resolved)).toHaveLength(TOKENS.length);
  });

  it("resolves every token for a light theme", () => {
    const resolved = deriveTheme(lightTheme());
    for (const token of TOKENS) {
      expect(resolved[token.key]).toBeTruthy();
    }
  });

  it("passes seed colors through verbatim", () => {
    const resolved = deriveTheme(darkTheme({ bg: "#28292c", text: "#ffffff" }));
    expect(resolved.bg).toBe("#28292c");
    expect(resolved.text).toBe("#ffffff");
  });
});

describe("alpha tokens", () => {
  it("uses white foreground on a dark scheme", () => {
    const resolved = deriveTheme(darkTheme());
    expect(resolved["text-secondary"]).toBe("rgba(255, 255, 255, 0.75)");
    expect(resolved["text-muted"]).toBe("rgba(255, 255, 255, 0.5)");
    expect(resolved.border).toBe("rgba(255, 255, 255, 0.1)");
  });

  it("uses black foreground on a light scheme", () => {
    const resolved = deriveTheme(lightTheme());
    expect(resolved["text-secondary"]).toBe("rgba(0, 0, 0, 0.75)");
    expect(resolved["text-muted"]).toBe("rgba(0, 0, 0, 0.5)");
    expect(resolved.border).toBe("rgba(0, 0, 0, 0.1)");
  });

  it("keeps overlay black on both schemes", () => {
    expect(deriveTheme(darkTheme()).overlay).toBe("rgba(0, 0, 0, 0.2)");
    expect(deriveTheme(lightTheme()).overlay).toBe("rgba(0, 0, 0, 0.2)");
    expect(deriveTheme(darkTheme())["overlay-hover"]).toBe("rgba(0, 0, 0, 0.3)");
    expect(deriveTheme(lightTheme())["overlay-hover"]).toBe("rgba(0, 0, 0, 0.3)");
  });
});

describe("shade tokens", () => {
  it("derives from the resolved base accent", () => {
    const resolved = deriveTheme(darkTheme({ accent: "#818cf8" }));
    expect(resolved["accent-dark"]).toBe(lighten("#818cf8", -0.08));
    expect(resolved["accent-darker"]).toBe(lighten("#818cf8", -0.16));
    expect(resolved["accent-text"]).toBe(lighten("#818cf8", 0.14));
    expect(resolved["wave-progress"]).toBe(lighten("#818cf8", 0));
  });

  it("wave-progress with lighten 0 equals the accent", () => {
    const resolved = deriveTheme(darkTheme({ accent: "#abcdef" }));
    expect(resolved["wave-progress"]).toBe("#abcdef");
  });
});

describe("explicit overrides", () => {
  it("an explicit token value beats derivation", () => {
    const resolved = deriveTheme(darkTheme({ accent: "#818cf8", "accent-dark": "#6470dc", "text-muted": "#777777" }));
    expect(resolved["accent-dark"]).toBe("#6470dc");
    expect(resolved["text-muted"]).toBe("#777777");
  });

  it("explicit shade override does not affect siblings", () => {
    const resolved = deriveTheme(darkTheme({ accent: "#818cf8", "accent-dark": "#000000" }));
    expect(resolved["accent-darker"]).toBe(lighten("#818cf8", -0.16));
  });
});

describe("contrast tokens", () => {
  it("resolves on-accent to white when accent-dark is dark", () => {
    const resolved = deriveTheme(darkTheme({ accent: "#3a3a8a", "accent-dark": "#3a3a8a" }));
    expect(resolved["on-accent"]).toBe("#ffffff");
  });

  it("resolves on-accent to near-black when accent-dark is light", () => {
    const resolved = deriveTheme(lightTheme({ accent: "#cfd4fb", "accent-dark": "#cfd4fb" }));
    expect(resolved["on-accent"]).toBe("#15161a");
  });

  it("regression: picks black on light accents like rosewater and moss, not white", () => {
    const rosewater = deriveTheme(darkTheme({ accent: "#e08aa6", "accent-dark": "#ce7f98" }));
    expect(rosewater["on-accent"]).toBe("#15161a");
    const moss = deriveTheme(darkTheme({ accent: "#6fc28a", "accent-dark": "#66b37f" }));
    expect(moss["on-accent"]).toBe("#15161a");
  });
});

describe("edge cases", () => {
  it("missing seed resolves to the magenta sentinel", () => {
    const theme: Theme = { id: "x", name: "broken", kind: "custom", scheme: "dark", tokens: {} };
    const resolved = deriveTheme(theme);
    expect(resolved.bg).toBe("#ff00ff");
  });

  it("a shade off a missing accent still produces a string", () => {
    const theme: Theme = { id: "x", name: "broken", kind: "custom", scheme: "dark", tokens: {} };
    const resolved = deriveTheme(theme);
    expect(resolved["accent-dark"]).toBe(lighten("#ff00ff", -0.08));
  });
});

describe("invariants", () => {
  it("never mutates the input theme tokens", () => {
    const theme = darkTheme();
    const before = JSON.stringify(theme.tokens);
    deriveTheme(theme);
    expect(JSON.stringify(theme.tokens)).toBe(before);
  });

  it("is deterministic", () => {
    const theme = darkTheme();
    expect(deriveTheme(theme)).toEqual(deriveTheme(theme));
  });
});
