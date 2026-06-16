import { describe, expect, it, vi } from "vitest";
import { QUICK_TOKENS, type Theme } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { ThemeEditorQuick } from "@/ui/settings/theme/theme-editor-quick";
import { render } from "@/test/render";

// -- Fixtures ------------------------------------------------------------------

function draftFrom(id: string, override?: Partial<Theme>): Theme {
  const base = PRESET_BY_ID.get(id);
  if (!base) throw new Error(`Unknown preset ${id}`);
  return {
    id: "draft",
    name: `${base.name} (copy)`,
    kind: "custom",
    base: id,
    scheme: base.scheme,
    tokens: { ...base.tokens },
    ...override,
  };
}

// -- Tests --------------------------------------------------------------------

describe("ThemeEditorQuick", () => {
  it("renders one input per quick token using its quick label", async () => {
    const screen = await render(<ThemeEditorQuick draft={draftFrom("default")} onTokenChange={() => {}} />);
    for (const token of QUICK_TOKENS) {
      await expect.element(screen.getByText(token.quick ?? token.label, { exact: true })).toBeInTheDocument();
    }
  });

  it("calls onTokenChange with the token key and new value when a swatch changes", async () => {
    const onTokenChange = vi.fn();
    const screen = await render(<ThemeEditorQuick draft={draftFrom("default")} onTokenChange={onTokenChange} />);
    const color = screen.getByLabelText("Accent color", { exact: true }).element() as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(color, "#abcdef");
    color.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onTokenChange).toHaveBeenCalledWith("accent", "#abcdef");
  });
});
