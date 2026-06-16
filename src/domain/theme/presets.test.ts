/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import { deriveTheme } from "./derive";
import { type ResolvedTheme, SEED_TOKENS } from "./model";
import { DEFAULT_PRESET_ID, PRESET_BY_ID, PRESETS } from "./presets";

describe("PRESETS shape", () => {
  it("ships 18 presets", () => {
    expect(PRESETS).toHaveLength(18);
  });

  it("every preset has kind preset", () => {
    for (const preset of PRESETS) {
      expect(preset.kind).toBe("preset");
    }
  });

  it("has unique ids", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the default preset under DEFAULT_PRESET_ID", () => {
    expect(DEFAULT_PRESET_ID).toBe("default");
    expect(PRESET_BY_ID.get(DEFAULT_PRESET_ID)?.name).toBe("Default");
  });

  it("PRESET_BY_ID indexes every preset", () => {
    expect(PRESET_BY_ID.size).toBe(PRESETS.length);
    for (const preset of PRESETS) {
      expect(PRESET_BY_ID.get(preset.id)).toBe(preset);
    }
  });

  it("groups presets into Composer and Classics", () => {
    const groups = new Set(PRESETS.map((p) => p.group));
    expect(groups).toEqual(new Set(["Composer", "Classics"]));
  });
});

describe("seed completeness", () => {
  it("every preset provides all seed tokens", () => {
    for (const preset of PRESETS) {
      for (const key of SEED_TOKENS) {
        expect(preset.tokens[key], `${preset.id} missing seed ${key}`).toBeTruthy();
      }
    }
  });

  it("every preset sets a snap token", () => {
    for (const preset of PRESETS) {
      expect(preset.tokens.snap).toBeTruthy();
    }
  });

  it("every preset sets an onset token", () => {
    for (const preset of PRESETS) {
      expect(preset.tokens.onset).toBeTruthy();
    }
  });

  it("never sets wave-progress explicitly (it derives)", () => {
    for (const preset of PRESETS) {
      expect(preset.tokens["wave-progress"]).toBeUndefined();
    }
  });
});

describe("derivation integrity", () => {
  it("deriveTheme leaves no magenta sentinel on any preset", () => {
    for (const preset of PRESETS) {
      const resolved = deriveTheme(preset);
      for (const value of Object.values(resolved)) {
        expect(value).not.toBe("#ff00ff");
      }
    }
  });

  it("every preset meets WCAG AA for text on bg", () => {
    for (const preset of PRESETS) {
      const resolved = deriveTheme(preset);
      const ratio = contrastRatio(resolved.text, resolved.bg);
      expect(ratio, `${preset.id} contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("regression: default preset reproduces the current look", () => {
  it("deriveTheme(default) equals the canonical token map", () => {
    const expected: ResolvedTheme = {
      bg: "#28292c",
      "bg-dark": "#1a1a1c",
      "bg-elevated": "#3e3e41",
      overlay: "rgba(0, 0, 0, 0.2)",
      "overlay-hover": "rgba(0, 0, 0, 0.3)",
      text: "#ffffff",
      "text-secondary": "rgba(255, 255, 255, 0.75)",
      "text-muted": "rgba(255, 255, 255, 0.5)",
      "text-disabled": "rgba(255, 255, 255, 0.4)",
      "text-tertiary": "#aaaaaa",
      "text-faint": "#696b77",
      button: "rgba(255, 255, 255, 0.1)",
      "button-hover": "rgba(255, 255, 255, 0.2)",
      input: "rgba(255, 255, 255, 0.05)",
      border: "rgba(255, 255, 255, 0.1)",
      "border-hover": "rgba(255, 255, 255, 0.15)",
      accent: "#818cf8",
      "accent-dark": "#6470dc",
      "accent-darker": "#505ac8",
      "accent-text": "#a5b4fc",
      "on-accent": "#ffffff",
      "accent-warm": "#d4a5a5",
      link: "#5865f2",
      error: "#b45555",
      "error-text": "#ffe5e5",
      warning: "#f5a623",
      explicit: "#ff7a85",
      wave: "#737476",
      "wave-progress": "#818cf8",
      snap: "#ffd66b",
      onset: "#4fd6c0",
    };
    const resolved = deriveTheme(PRESET_BY_ID.get("default") as NonNullable<ReturnType<typeof PRESET_BY_ID.get>>);
    expect(resolved).toEqual(expected);
  });
});

describe("light preset description", () => {
  it("uses the expected copy", () => {
    expect(PRESET_BY_ID.get("light")?.desc).toBe("Seek help");
  });
});

describe("high contrast accent", () => {
  it("reuses the Default preset's accent", () => {
    const highContrast = PRESET_BY_ID.get("high-contrast");
    const def = PRESET_BY_ID.get("default");
    if (!highContrast || !def) throw new Error("missing preset");
    expect(highContrast.tokens.accent).toBe(def.tokens.accent);
  });
});

describe("light preset accent", () => {
  it("derives a dark on-accent for the Light preset's light accent-dark", () => {
    const light = PRESET_BY_ID.get("light");
    if (!light) throw new Error("missing Light preset");
    expect(deriveTheme(light)["on-accent"]).toBe("#15161a");
  });

  it("keeps Light preset text/bg contrast at AA", () => {
    const light = PRESET_BY_ID.get("light");
    if (!light) throw new Error("missing Light preset");
    const resolved = deriveTheme(light);
    expect(contrastRatio(resolved.text, resolved.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("light presets", () => {
  it("light presets carry scheme light and a clean-amber snap", () => {
    const lightIds = PRESETS.filter((p) => p.scheme === "light").map((p) => p.id);
    expect(lightIds).toContain("light");
    expect(lightIds).toContain("solarized-light");
    for (const id of lightIds) {
      expect(PRESET_BY_ID.get(id)?.tokens.snap).toBe("#f5a623");
    }
  });

  it("dark presets use the bright snap", () => {
    for (const preset of PRESETS) {
      if (preset.scheme === "dark") {
        expect(preset.tokens.snap).toBe("#ffd66b");
      }
    }
  });

  it("light presets carry the darker teal onset", () => {
    for (const preset of PRESETS) {
      if (preset.scheme === "light") {
        expect(preset.tokens.onset).toBe("#2a9d8f");
      }
    }
  });

  it("dark presets use the bright teal onset", () => {
    for (const preset of PRESETS) {
      if (preset.scheme === "dark") {
        expect(preset.tokens.onset).toBe("#4fd6c0");
      }
    }
  });
});
