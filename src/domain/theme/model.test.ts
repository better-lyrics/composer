/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { QUICK_TOKENS, SEED_TOKENS, TOKEN_VAR, TOKENS, type TokenKey } from "./model";

const EXPECTED_KEYS: TokenKey[] = [
  "bg",
  "bg-dark",
  "bg-elevated",
  "overlay",
  "overlay-hover",
  "text",
  "text-secondary",
  "text-muted",
  "text-disabled",
  "text-tertiary",
  "text-faint",
  "button",
  "button-hover",
  "input",
  "border",
  "border-hover",
  "accent",
  "accent-dark",
  "accent-darker",
  "accent-text",
  "on-accent",
  "accent-warm",
  "link",
  "error",
  "error-text",
  "warning",
  "explicit",
  "wave",
  "wave-progress",
  "snap",
  "onset",
];

describe("TOKENS", () => {
  it("defines exactly 31 tokens (29 from the plan table plus on-accent and onset)", () => {
    expect(TOKENS).toHaveLength(31);
  });

  it("defines on-accent as a contrast token derived from accent-dark", () => {
    const onAccent = TOKENS.find((t) => t.key === "on-accent");
    expect(onAccent?.type).toBe("contrast");
    expect(onAccent?.from).toBe("accent-dark");
  });

  it("places accent-dark before on-accent", () => {
    const accentDark = TOKENS.findIndex((t) => t.key === "accent-dark");
    const onAccent = TOKENS.findIndex((t) => t.key === "on-accent");
    expect(accentDark).toBeLessThan(onAccent);
  });

  it("covers every expected key", () => {
    expect(TOKENS.map((t) => t.key)).toEqual(EXPECTED_KEYS);
  });

  it("maps every varName under --color-composer-<key>", () => {
    for (const token of TOKENS) {
      expect(token.varName).toBe(`--color-composer-${token.key}`);
    }
  });

  it("gives every token a label and group", () => {
    for (const token of TOKENS) {
      expect(token.label.length).toBeGreaterThan(0);
      expect(token.group.length).toBeGreaterThan(0);
    }
  });

  it("assigns alpha params only to alpha tokens", () => {
    for (const token of TOKENS) {
      if (token.type === "alpha") {
        expect(typeof token.alpha).toBe("number");
      } else {
        expect(token.alpha).toBeUndefined();
      }
    }
  });

  it("assigns from + lighten only to shade tokens", () => {
    for (const token of TOKENS) {
      if (token.type === "shade") {
        expect(token.from).toBeDefined();
        expect(typeof token.lighten).toBe("number");
      } else if (token.type === "contrast") {
        expect(token.from).toBeDefined();
        expect(token.lighten).toBeUndefined();
      } else {
        expect(token.from).toBeUndefined();
        expect(token.lighten).toBeUndefined();
      }
    }
  });

  it("marks overlay tokens as on shadow, other alpha as fg", () => {
    const overlay = TOKENS.find((t) => t.key === "overlay");
    const overlayHover = TOKENS.find((t) => t.key === "overlay-hover");
    expect(overlay?.on).toBe("shadow");
    expect(overlayHover?.on).toBe("shadow");
    const textSecondary = TOKENS.find((t) => t.key === "text-secondary");
    expect(textSecondary?.on).toBe("fg");
  });
});

describe("ordering invariants", () => {
  const indexOf = (key: TokenKey) => TOKENS.findIndex((t) => t.key === key);

  it("places every shade's from before the shade itself", () => {
    for (let i = 0; i < TOKENS.length; i++) {
      const token = TOKENS[i];
      if (token.type === "shade" && token.from) {
        expect(indexOf(token.from)).toBeLessThan(i);
      }
    }
  });

  it("places accent before accent-dark, accent-darker, accent-text, wave-progress", () => {
    const accent = indexOf("accent");
    expect(accent).toBeLessThan(indexOf("accent-dark"));
    expect(accent).toBeLessThan(indexOf("accent-darker"));
    expect(accent).toBeLessThan(indexOf("accent-text"));
    expect(accent).toBeLessThan(indexOf("wave-progress"));
  });
});

describe("derived exports", () => {
  it("QUICK_TOKENS has exactly the 10 quick-labelled tokens", () => {
    expect(QUICK_TOKENS).toHaveLength(10);
    expect(QUICK_TOKENS.every((t) => typeof t.quick === "string")).toBe(true);
    expect(QUICK_TOKENS.map((t) => t.key)).toEqual([
      "bg",
      "bg-elevated",
      "text",
      "text-muted",
      "border",
      "accent",
      "accent-text",
      "accent-warm",
      "error",
      "warning",
    ]);
  });

  it("bg-dark is not a quick token", () => {
    expect(QUICK_TOKENS.find((t) => t.key === "bg-dark")).toBeUndefined();
    const bgDark = TOKENS.find((t) => t.key === "bg-dark");
    expect(bgDark?.quick).toBeUndefined();
  });

  it("SEED_TOKENS lists the 16 seed keys", () => {
    expect(SEED_TOKENS).toHaveLength(16);
    expect(SEED_TOKENS).toEqual([
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

  it("TOKEN_VAR maps every key to its var", () => {
    expect(Object.keys(TOKEN_VAR)).toHaveLength(31);
    for (const token of TOKENS) {
      expect(TOKEN_VAR[token.key]).toBe(token.varName);
    }
  });
});

describe("invariants", () => {
  it("has no duplicate keys", () => {
    const keys = TOKENS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate varNames", () => {
    const vars = TOKENS.map((t) => t.varName);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("every varName starts with --color-composer-", () => {
    for (const token of TOKENS) {
      expect(token.varName.startsWith("--color-composer-")).toBe(true);
    }
  });
});
