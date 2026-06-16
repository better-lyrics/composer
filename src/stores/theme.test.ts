import { beforeEach, describe, expect, it } from "vitest";
import { encodeThemeCode } from "@/domain/theme/code";
import type { Theme } from "@/domain/theme/model";
import { initTheme, useThemeStore } from "@/stores/theme";

const ACCENT_VAR = "--color-composer-accent";

function readAccent(): string {
  return document.documentElement.style.getPropertyValue(ACCENT_VAR);
}

function makeCustom(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "custom-1",
    name: "My Theme",
    kind: "custom",
    scheme: "dark",
    tokens: { accent: "#123456" },
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.removeItem("composer-theme");
  useThemeStore.setState({ activeThemeId: "default", customThemes: [] });
  document.documentElement.style.removeProperty(ACCENT_VAR);
});

describe("theme store · defaults", () => {
  it("defaults to the default preset with no custom themes", () => {
    const state = useThemeStore.getState();
    expect(state.activeThemeId).toBe("default");
    expect(state.customThemes).toEqual([]);
  });
});

describe("theme store · getThemeById", () => {
  it("finds a preset by id", () => {
    expect(useThemeStore.getState().getThemeById("dracula")?.name).toBe("Dracula");
  });

  it("finds a custom theme by id", () => {
    const custom = makeCustom();
    useThemeStore.getState().addCustomTheme(custom);
    expect(useThemeStore.getState().getThemeById("custom-1")).toEqual(custom);
  });

  it("returns undefined for an unknown id", () => {
    expect(useThemeStore.getState().getThemeById("nope")).toBeUndefined();
  });
});

describe("theme store · setActiveTheme", () => {
  it("applies the chosen preset's resolved accent to documentElement", () => {
    useThemeStore.getState().setActiveTheme("dracula");
    expect(useThemeStore.getState().activeThemeId).toBe("dracula");
    expect(readAccent()).toBe("#bd93f9");
  });

  it("falls back to default (id and tokens) for an unknown id so persisted state self-heals", () => {
    useThemeStore.getState().setActiveTheme("does-not-exist");
    expect(useThemeStore.getState().activeThemeId).toBe("default");
    expect(readAccent()).toBe("#818cf8");
  });

  it("applies a custom theme when it is active", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().setActiveTheme("custom-1");
    expect(readAccent()).toBe("#123456");
  });
});

describe("theme store · addCustomTheme", () => {
  it("appends to customThemes", () => {
    const a = makeCustom({ id: "a" });
    const b = makeCustom({ id: "b" });
    useThemeStore.getState().addCustomTheme(a);
    useThemeStore.getState().addCustomTheme(b);
    expect(useThemeStore.getState().customThemes).toEqual([a, b]);
  });
});

describe("theme store · updateCustomTheme", () => {
  it("merges the patch into the matching custom theme", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().updateCustomTheme("custom-1", { name: "Renamed" });
    const updated = useThemeStore.getState().getThemeById("custom-1");
    expect(updated?.name).toBe("Renamed");
    expect(updated?.tokens.accent).toBe("#123456");
  });

  it("re-applies when the updated theme is active", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().setActiveTheme("custom-1");
    useThemeStore.getState().updateCustomTheme("custom-1", { tokens: { accent: "#abcdef" } });
    expect(readAccent()).toBe("#abcdef");
  });

  it("does not re-apply when the updated theme is not active", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().setActiveTheme("dracula");
    useThemeStore.getState().updateCustomTheme("custom-1", { tokens: { accent: "#abcdef" } });
    expect(readAccent()).toBe("#bd93f9");
  });

  it("ignores an unknown id", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().updateCustomTheme("unknown", { name: "x" });
    expect(useThemeStore.getState().getThemeById("custom-1")?.name).toBe("My Theme");
  });
});

describe("theme store · deleteCustomTheme", () => {
  it("removes the matching custom theme", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().deleteCustomTheme("custom-1");
    expect(useThemeStore.getState().customThemes).toEqual([]);
  });

  it("falls back to default and applies it when deleting the active custom theme", () => {
    useThemeStore.getState().addCustomTheme(makeCustom());
    useThemeStore.getState().setActiveTheme("custom-1");
    useThemeStore.getState().deleteCustomTheme("custom-1");
    expect(useThemeStore.getState().activeThemeId).toBe("default");
    expect(readAccent()).toBe("#818cf8");
  });

  it("leaves the active theme alone when deleting a non-active custom theme", () => {
    useThemeStore.getState().addCustomTheme(makeCustom({ id: "a" }));
    useThemeStore.getState().addCustomTheme(makeCustom({ id: "b" }));
    useThemeStore.getState().setActiveTheme("a");
    document.documentElement.style.removeProperty(ACCENT_VAR);
    useThemeStore.getState().deleteCustomTheme("b");
    expect(useThemeStore.getState().activeThemeId).toBe("a");
    expect(readAccent()).toBe("");
  });
});

describe("theme store · importThemeCode", () => {
  it("appends a custom theme and returns it without auto-activating", () => {
    const source = makeCustom({ name: "Shared", tokens: { accent: "#0a0b0c" } });
    const code = encodeThemeCode(source);
    const imported = useThemeStore.getState().importThemeCode(code, () => "imported-id");
    expect(imported.id).toBe("imported-id");
    expect(imported.kind).toBe("custom");
    expect(imported.name).toBe("Shared");
    expect(useThemeStore.getState().customThemes).toContainEqual(imported);
    expect(useThemeStore.getState().activeThemeId).toBe("default");
    expect(readAccent()).toBe("");
  });

  it("throws on a malformed code and does not append", () => {
    expect(() => useThemeStore.getState().importThemeCode("garbage")).toThrow();
    expect(useThemeStore.getState().customThemes).toEqual([]);
  });

  it("uses crypto.randomUUID by default", () => {
    const code = encodeThemeCode(makeCustom());
    const imported = useThemeStore.getState().importThemeCode(code);
    expect(typeof imported.id).toBe("string");
    expect(imported.id.length).toBeGreaterThan(0);
  });
});

describe("theme store · initTheme", () => {
  it("applies the currently active theme synchronously", () => {
    useThemeStore.setState({ activeThemeId: "dracula", customThemes: [] });
    document.documentElement.style.removeProperty(ACCENT_VAR);
    initTheme();
    expect(readAccent()).toBe("#bd93f9");
  });
});

describe("theme store · persistence", () => {
  it("round-trips activeThemeId and customThemes and re-applies on rehydrate", async () => {
    const custom = makeCustom({ id: "persisted", tokens: { accent: "#fafbfc" } });
    window.localStorage.setItem(
      "composer-theme",
      JSON.stringify({ state: { activeThemeId: "persisted", customThemes: [custom] }, version: 1 }),
    );
    document.documentElement.style.removeProperty(ACCENT_VAR);
    await useThemeStore.persist.rehydrate();
    const state = useThemeStore.getState();
    expect(state.activeThemeId).toBe("persisted");
    expect(state.customThemes).toEqual([custom]);
    expect(readAccent()).toBe("#fafbfc");
  });

  it("persists both activeThemeId and customThemes", () => {
    useThemeStore.getState().addCustomTheme(makeCustom({ id: "saved" }));
    useThemeStore.getState().setActiveTheme("dracula");
    const persisted = window.localStorage.getItem("composer-theme");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!) as { state: { activeThemeId: string; customThemes: Theme[] } };
    expect(parsed.state.activeThemeId).toBe("dracula");
    expect(parsed.state.customThemes.map((t) => t.id)).toEqual(["saved"]);
  });
});
