import { describe, expect, it, vi } from "vitest";
import { deriveTheme } from "@/domain/theme/derive";
import { type Theme, TOKENS } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { ThemeEditorAdvanced } from "@/ui/settings/theme/theme-editor-advanced";
import { render } from "@/test/render";

// -- Fixtures ------------------------------------------------------------------

function draftFrom(id: string): Theme {
  const base = PRESET_BY_ID.get(id);
  if (!base) throw new Error(`Unknown preset ${id}`);
  return {
    id: "draft",
    name: `${base.name} (copy)`,
    kind: "custom",
    base: id,
    scheme: base.scheme,
    tokens: { ...base.tokens },
  };
}

// -- Tests --------------------------------------------------------------------

describe("ThemeEditorAdvanced", () => {
  it("renders labels from multiple token groups", async () => {
    const screen = await render(<ThemeEditorAdvanced draft={draftFrom("default")} onTokenChange={() => {}} />);
    await expect.element(screen.getByText("Deep background", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByText("Link", { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByLabelText("Accent color", { exact: true })).toBeInTheDocument();
  });

  it("shows alpha tokens as read-only resolved values with no swatch input", async () => {
    const draft = draftFrom("default");
    const resolved = deriveTheme(draft);
    const screen = await render(<ThemeEditorAdvanced draft={draft} onTokenChange={() => {}} />);
    await expect.element(screen.getByText("Muted text")).toBeInTheDocument();
    expect(document.body.textContent).toContain(resolved["text-muted"]);
    expect(document.querySelector("input[aria-label='Muted text color']")).toBeNull();
  });

  it("renders an editable swatch for seed tokens", async () => {
    const screen = await render(<ThemeEditorAdvanced draft={draftFrom("default")} onTokenChange={() => {}} />);
    await expect.element(screen.getByLabelText("Background color", { exact: true })).toBeInTheDocument();
  });

  it("calls onTokenChange when a seed swatch fires input", async () => {
    const onTokenChange = vi.fn();
    const screen = await render(<ThemeEditorAdvanced draft={draftFrom("default")} onTokenChange={onTokenChange} />);
    const color = screen.getByLabelText("Background color", { exact: true }).element() as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(color, "#101010");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onTokenChange).toHaveBeenCalledWith("bg", "#101010");
  });

  it("renders seed/shade tokens as editable and alpha/contrast tokens as read-only", async () => {
    await render(<ThemeEditorAdvanced draft={draftFrom("default")} onTokenChange={() => {}} />);
    for (const token of TOKENS) {
      const swatch = document.querySelector(`input[aria-label='${token.label} color']`);
      if (token.type === "alpha" || token.type === "contrast") {
        expect(swatch, `${token.label} should be read-only`).toBeNull();
      } else {
        expect(swatch, `${token.label} should be editable`).not.toBeNull();
      }
    }
  });
});
