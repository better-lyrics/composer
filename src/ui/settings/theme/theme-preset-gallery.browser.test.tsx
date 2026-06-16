import { describe, expect, it, vi } from "vitest";
import type { Theme } from "@/domain/theme/model";
import { useThemeStore } from "@/stores/theme";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { ThemePresetGallery } from "@/ui/settings/theme/theme-preset-gallery";
import { render } from "@/test/render";

// -- Fixtures -----------------------------------------------------------------

function makeCustomTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "custom-1",
    name: "My Theme",
    kind: "custom",
    scheme: "dark",
    desc: "Saved by you.",
    tokens: { bg: "#101010", text: "#ffffff", accent: "#ff8800" },
    ...overrides,
  };
}

// -- Tests --------------------------------------------------------------------

describe("ThemePresetGallery", () => {
  it("renders the Built-in and Classics group headings", async () => {
    const screen = await render(<ThemePresetGallery />);
    await expect.element(screen.getByText("Built-in")).toBeInTheDocument();
    await expect.element(screen.getByText("Classics")).toBeInTheDocument();
  });

  it("renders at least the Default and Dracula preset cards", async () => {
    const screen = await render(<ThemePresetGallery />);
    await expect.element(screen.getByRole("button", { name: /Default/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Dracula/ })).toBeInTheDocument();
  });

  it("applies a non-active theme when its card is clicked", async () => {
    const screen = await render(<ThemePresetGallery />);
    expect(useThemeStore.getState().activeThemeId).not.toBe("nord");
    await screen.getByRole("button", { name: /Nord/ }).click();
    expect(useThemeStore.getState().activeThemeId).toBe("nord");
  });

  it("marks the active card per the store's activeThemeId", async () => {
    useThemeStore.setState({ activeThemeId: "dracula" });
    const screen = await render(<ThemePresetGallery />);
    const dracula = screen.getByRole("button", { name: /Dracula/ }).element();
    expect(dracula.className).toContain("border-composer-accent");
    const nord = screen.getByRole("button", { name: /Nord/ }).element();
    expect(nord.className).not.toContain("border-composer-accent");
  });

  it("renders the 'Your themes' group with custom theme cards when customs exist", async () => {
    useThemeStore.setState({ customThemes: [makeCustomTheme()] });
    const screen = await render(<ThemePresetGallery />);
    await expect.element(screen.getByText("Your themes")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /^My Theme/ })).toBeInTheDocument();
  });

  it("invokes onEditCustom with the theme id when a custom card's edit button is clicked", async () => {
    useThemeStore.setState({ customThemes: [makeCustomTheme()] });
    const onEditCustom = vi.fn();
    const screen = await render(<ThemePresetGallery onEditCustom={onEditCustom} />);
    await screen.getByRole("button", { name: "Edit My Theme" }).click();
    expect(onEditCustom).toHaveBeenCalledWith("custom-1");
  });

  it("removes a custom theme only after the delete is confirmed", async () => {
    useThemeStore.setState({ customThemes: [makeCustomTheme()] });
    const screen = await render(
      <>
        <ThemePresetGallery />
        <ConfirmModalHost />
      </>,
    );
    await screen.getByRole("button", { name: "Delete My Theme" }).click();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => useThemeStore.getState().customThemes.length).toBe(0);
  });

  it("keeps the custom theme when the delete confirmation is cancelled", async () => {
    useThemeStore.setState({ customThemes: [makeCustomTheme()] });
    const screen = await render(
      <>
        <ThemePresetGallery />
        <ConfirmModalHost />
      </>,
    );
    await screen.getByRole("button", { name: "Delete My Theme" }).click();
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(() => useThemeStore.getState().customThemes.length).toBe(1);
  });

  it("does not render the 'Your themes' group when there are no customs", async () => {
    const screen = await render(<ThemePresetGallery />);
    expect(screen.container.textContent).not.toContain("Your themes");
  });

  it("renders a customize button that calls onCustomize when provided", async () => {
    const onCustomize = vi.fn();
    const screen = await render(<ThemePresetGallery onCustomize={onCustomize} />);
    await screen.getByRole("button", { name: /Customize/ }).click();
    expect(onCustomize).toHaveBeenCalled();
  });

  it("omits the customize button when no handler is provided", async () => {
    const screen = await render(<ThemePresetGallery />);
    expect(screen.container.textContent).not.toContain("Customize");
  });
});
