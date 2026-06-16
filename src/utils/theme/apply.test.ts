import { beforeEach, describe, expect, it } from "vitest";
import { deriveTheme } from "@/domain/theme/derive";
import { type ResolvedTheme, type Scheme, TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { applyResolvedTheme } from "@/utils/theme/apply";

function resolvePreset(id: string): { resolved: ResolvedTheme; scheme: Scheme } {
  const theme = PRESET_BY_ID.get(id);
  if (!theme) throw new Error(`missing preset ${id}`);
  return { resolved: deriveTheme(theme), scheme: theme.scheme };
}

function clearTokenVars(): void {
  const root = document.documentElement;
  for (const t of TOKENS) root.style.removeProperty(t.varName);
  root.style.removeProperty("color-scheme");
  delete root.dataset.scheme;
}

beforeEach(() => {
  clearTokenVars();
});

describe("applyResolvedTheme", () => {
  it("sets --color-composer-accent to the resolved accent", () => {
    const { resolved, scheme } = resolvePreset("dracula");
    applyResolvedTheme(resolved, scheme);
    expect(document.documentElement.style.getPropertyValue("--color-composer-accent")).toBe(resolved.accent);
    expect(resolved.accent).toBe("#bd93f9");
  });

  it("sets every token var", () => {
    const { resolved, scheme } = resolvePreset("default");
    applyResolvedTheme(resolved, scheme);
    const root = document.documentElement;
    for (const t of TOKENS) {
      expect(root.style.getPropertyValue(t.varName)).toBe(resolved[t.key]);
    }
  });

  it("sets color-scheme to the passed scheme (dark)", () => {
    const { resolved } = resolvePreset("default");
    applyResolvedTheme(resolved, "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("sets color-scheme to the passed scheme (light)", () => {
    const { resolved } = resolvePreset("default");
    applyResolvedTheme(resolved, "light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("stamps data-scheme so CSS can branch on the active scheme", () => {
    const { resolved } = resolvePreset("default");
    applyResolvedTheme(resolved, "light");
    expect(document.documentElement.dataset.scheme).toBe("light");
    applyResolvedTheme(resolved, "dark");
    expect(document.documentElement.dataset.scheme).toBe("dark");
  });

  it("overwrites a previously applied theme's vars", () => {
    const first = resolvePreset("default");
    applyResolvedTheme(first.resolved, first.scheme);
    const second = resolvePreset("dracula");
    applyResolvedTheme(second.resolved, second.scheme);
    expect(document.documentElement.style.getPropertyValue("--color-composer-accent")).toBe(second.resolved.accent);
  });
});
