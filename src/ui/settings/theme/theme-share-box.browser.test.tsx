import { describe, expect, it } from "vitest";
import { encodeThemeCode } from "@/domain/theme/code";
import type { Theme } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { ThemeShareBox } from "@/ui/settings/theme/theme-share-box";
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

describe("ThemeShareBox", () => {
  it("shows the encoded theme code in a read-only textarea", async () => {
    const draft = draftFrom("harbor");
    const screen = await render(<ThemeShareBox draft={draft} />);
    const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.value).toBe(encodeThemeCode(draft));
  });

  it("encodes a different draft's code", async () => {
    const next = draftFrom("nord");
    const screen = await render(<ThemeShareBox draft={next} />);
    const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
    expect(box.value).toBe(encodeThemeCode(next));
  });

  it("renders a Copy code button", async () => {
    const screen = await render(<ThemeShareBox draft={draftFrom("harbor")} />);
    await expect.element(screen.getByRole("button", { name: /Copy code/ })).toBeInTheDocument();
  });

  it("switches the button to Copied after a copy click", async () => {
    const screen = await render(<ThemeShareBox draft={draftFrom("harbor")} />);
    await screen.getByRole("button", { name: /Copy code/ }).click();
    await expect.element(screen.getByRole("button", { name: /Copied/ })).toBeInTheDocument();
  });
});
