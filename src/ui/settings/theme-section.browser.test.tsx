import { beforeEach, describe, expect, it } from "vitest";
import { encodeThemeCode } from "@/domain/theme/code";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { useThemeStore } from "@/stores/theme";
import { ThemeSection } from "@/ui/settings/theme-section";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("ThemeSection", () => {
  beforeEach(() => {
    useThemeStore.setState({ activeThemeId: DEFAULT_PRESET_ID, customThemes: [] });
  });

  it("renders the preset gallery with a Composer and a classic preset", async () => {
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    await expect.element(screen.getByRole("button", { name: /Default/ })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Dracula/ })).toBeInTheDocument();
  });

  it("opens the editor when Customize current is clicked", async () => {
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    await screen.getByRole("button", { name: "Customize current" }).click();
    await expect.element(screen.getByLabelText("Theme name")).toBeInTheDocument();
  });

  it("forks the active theme as the editor base", async () => {
    useThemeStore.setState({ activeThemeId: "harbor" });
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    await screen.getByRole("button", { name: "Customize current" }).click();
    const name = screen.getByLabelText("Theme name").element() as HTMLInputElement;
    expect(name.value).toBe(`${PRESET_BY_ID.get("harbor")?.name} (copy)`);
  });

  it("opens the editor in edit mode when a custom card's edit button is clicked", async () => {
    useThemeStore.setState({
      customThemes: [
        {
          id: "custom-section-1",
          name: "Saved One",
          kind: "custom",
          scheme: "dark",
          tokens: { bg: "#101010", text: "#ffffff", accent: "#ff8800" },
        },
      ],
    });
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    await screen.getByRole("button", { name: "Edit Saved One" }).click();
    const name = screen.getByLabelText("Theme name").element() as HTMLInputElement;
    expect(name.value).toBe("Saved One");
    await expect.element(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("imports a valid code, growing customThemes and clearing the input", async () => {
    const preset = PRESET_BY_ID.get("nord");
    if (!preset) throw new Error("missing preset");
    const code = encodeThemeCode(preset);
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    const input = screen.getByLabelText("Theme code");
    await input.fill(code);
    await screen.getByRole("button", { name: /Import/ }).click();
    expect(useThemeStore.getState().customThemes.length).toBe(1);
    expect((input.element() as HTMLInputElement).value).toBe("");
  });

  it("shows an inline error for an invalid code and does not grow customThemes", async () => {
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    const input = screen.getByLabelText("Theme code");
    await input.fill("bogus");
    await screen.getByRole("button", { name: /Import/ }).click();
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    expect(useThemeStore.getState().customThemes.length).toBe(0);
  });

  it("re-applies the active theme when the editor closes", async () => {
    const screen = await render(<ThemeSection onResetTour={() => {}} onClose={() => {}} />);
    await screen.getByRole("button", { name: "Customize current" }).click();
    await screen.getByRole("button", { name: "Discard" }).click();
    await expect.element(screen.getByRole("button", { name: "Customize current" })).toBeInTheDocument();
    const resolvedBg = PRESET_BY_ID.get(DEFAULT_PRESET_ID)?.tokens.bg;
    expect(document.documentElement.style.getPropertyValue("--color-composer-bg").trim()).toBe(resolvedBg);
  });
});
