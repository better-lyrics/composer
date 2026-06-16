import { describe, expect, it, vi } from "vitest";
import type { Theme } from "@/domain/theme/model";
import { PRESET_BY_ID } from "@/domain/theme/presets";
import { ThemePresetCard } from "@/ui/settings/theme/theme-preset-card";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function themeById(id: string) {
  const theme = PRESET_BY_ID.get(id);
  if (!theme) throw new Error(`missing preset ${id}`);
  return theme;
}

const DEFAULT = themeById("default");
const LIGHT = themeById("light");

const CUSTOM: Theme = {
  id: "custom-card-1",
  name: "My Theme",
  kind: "custom",
  scheme: "dark",
  desc: "Saved by you.",
  tokens: { bg: "#101010", text: "#ffffff", accent: "#ff8800" },
};

// -- Tests --------------------------------------------------------------------

describe("ThemePresetCard", () => {
  it("renders the name, description, and exactly 6 color chips", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} />);
    await expect.element(screen.getByText(DEFAULT.name)).toBeInTheDocument();
    if (DEFAULT.desc) await expect.element(screen.getByText(DEFAULT.desc)).toBeInTheDocument();
    const chips = document.querySelectorAll("[data-theme-chip]");
    expect(chips.length).toBe(6);
  });

  it("calls onSelect with the theme id when clicked", async () => {
    const onSelect = vi.fn();
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={onSelect} />);
    await screen.getByRole("button", { name: new RegExp(DEFAULT.name) }).click();
    expect(onSelect).toHaveBeenCalledWith(DEFAULT.id);
  });

  it("adds the active ring class when active is true", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={true} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: new RegExp(DEFAULT.name) }).element();
    expect(button.className).toContain("ring");
    expect(button.className).toContain("border-composer-accent");
  });

  it("does not add the active ring when active is false", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: new RegExp(DEFAULT.name) }).element();
    expect(button.className).not.toContain("ring-2");
  });

  it("renders a sun-icon pill and the is-light treatment for a light-scheme theme", async () => {
    const screen = await render(<ThemePresetCard theme={LIGHT} active={false} onSelect={() => {}} />);
    await expect.element(screen.getByLabelText("Light theme")).toBeInTheDocument();
    const pill = document.querySelector("[data-theme-pill]");
    expect(pill?.getAttribute("data-light")).toBe("true");
  });

  it("renders a moon-icon pill and no is-light treatment for a dark-scheme theme", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} />);
    await expect.element(screen.getByLabelText("Dark theme")).toBeInTheDocument();
    const pill = document.querySelector("[data-theme-pill]");
    expect(pill?.getAttribute("data-light")).toBe("false");
  });

  it("prefixes the description with 'Custom · ' when custom is true", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} custom />);
    await expect.element(screen.getByText(`Custom · ${DEFAULT.desc}`)).toBeInTheDocument();
  });

  it("has no hover translate or transform in its className", async () => {
    const screen = await render(<ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: new RegExp(DEFAULT.name) }).element();
    expect(button.className).not.toMatch(/translate/);
    expect(button.className).not.toMatch(/transform/);
  });
});

describe("ThemePresetCard custom actions", () => {
  it("renders edit and delete buttons for a custom card with handlers", async () => {
    const screen = await render(
      <ThemePresetCard
        theme={CUSTOM}
        active={false}
        onSelect={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        custom
      />,
    );
    await expect.element(screen.getByRole("button", { name: "Edit My Theme" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Delete My Theme" })).toBeInTheDocument();
  });

  it("renders no action buttons for a non-custom card even when handlers are passed", async () => {
    await render(
      <ThemePresetCard theme={DEFAULT} active={false} onSelect={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );
    expect(document.querySelector('[aria-label^="Edit "]')).toBeNull();
    expect(document.querySelector('[aria-label^="Delete "]')).toBeNull();
  });

  it("calls onEdit with the id and does not select when edit is clicked", async () => {
    const onEdit = vi.fn();
    const onSelect = vi.fn();
    const screen = await render(
      <ThemePresetCard theme={CUSTOM} active={false} onSelect={onSelect} onEdit={onEdit} onDelete={() => {}} custom />,
    );
    await screen.getByRole("button", { name: "Edit My Theme" }).click();
    expect(onEdit).toHaveBeenCalledWith(CUSTOM.id);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onDelete with the id and does not select when delete is clicked", async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const screen = await render(
      <ThemePresetCard
        theme={CUSTOM}
        active={false}
        onSelect={onSelect}
        onEdit={() => {}}
        onDelete={onDelete}
        custom
      />,
    );
    await screen.getByRole("button", { name: "Delete My Theme" }).click();
    expect(onDelete).toHaveBeenCalledWith(CUSTOM.id);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
