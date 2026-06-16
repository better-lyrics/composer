import { beforeEach, describe, expect, it } from "vitest";
import { encodeThemeCode } from "@/domain/theme/code";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { useThemeStore } from "@/stores/theme";
import { ThemeEditor } from "@/ui/settings/theme/theme-editor";
import { render } from "@/test/render";

// -- Helpers -------------------------------------------------------------------

function nameInput(screen: Awaited<ReturnType<typeof render>>): HTMLInputElement {
  return screen.getByLabelText("Theme name").element() as HTMLInputElement;
}

function readVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim();
}

function visibleInput(label: string): HTMLInputElement {
  const inputs = [...document.querySelectorAll<HTMLInputElement>(`input[aria-label="${label}"]`)];
  const visible = inputs.find((input) => input.checkVisibility());
  if (!visible) throw new Error(`No visible input labelled "${label}"`);
  return visible;
}

async function fillVisibleHex(label: string, value: string): Promise<void> {
  const input = visibleInput(label);
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

// -- Tests --------------------------------------------------------------------

describe("ThemeEditor", () => {
  beforeEach(() => {
    useThemeStore.setState({ activeThemeId: DEFAULT_PRESET_ID, customThemes: [] });
  });

  it("forks the base theme into a draft named '<base> (copy)'", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    const base = PRESET_BY_ID.get(DEFAULT_PRESET_ID);
    expect(nameInput(screen).value).toBe(`${base?.name} (copy)`);
  });

  it("vertically centers the Close button against the theme-name input", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    const input = nameInput(screen);
    const close = screen.getByRole("button", { name: "Close" }).element() as HTMLButtonElement;
    const inputRect = input.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const inputCenter = inputRect.top + inputRect.height / 2;
    const closeCenter = closeRect.top + closeRect.height / 2;
    expect(Math.abs(closeCenter - inputCenter)).toBeLessThanOrEqual(2);
  });

  it("falls back to the default preset when the base id is unknown", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: "does-not-exist" }} onClose={() => {}} />,
    );
    const fallback = PRESET_BY_ID.get(DEFAULT_PRESET_ID);
    expect(nameInput(screen).value).toBe(`${fallback?.name} (copy)`);
  });

  it("live-previews the accent when a Quick accent slot changes", async () => {
    await render(<ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />);
    await fillVisibleHex("Accent hex", "#123456");
    await expect.poll(() => readVar("--color-composer-accent")).toBe("#123456");
  });

  it("flips muted text alpha to black when the scheme toggles to Light", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    await screen.getByRole("button", { name: "Light" }).click();
    await expect.poll(() => readVar("--color-composer-text-muted")).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("lists tokens from multiple groups in the Advanced pane", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    await screen.getByRole("button", { name: "Advanced" }).click();
    expect(document.body.textContent).toContain("Backgrounds");
    expect(document.body.textContent).toContain("Deep background");
    expect(document.body.textContent).toContain("Link");
  });

  it("shows the contrast warning for a low-contrast draft and hides it for a normal one", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    expect(document.body.textContent).not.toContain("below WCAG AA");

    await fillVisibleHex("Background hex", "#fefefe");
    await fillVisibleHex("Text hex", "#ffffff");

    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    expect(document.body.textContent).toContain("below WCAG AA");
  });

  it("keeps the contrast warning visible after switching to the Advanced tab", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    await fillVisibleHex("Background hex", "#fefefe");
    await fillVisibleHex("Text hex", "#ffffff");
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();

    await screen.getByRole("button", { name: "Advanced" }).click();
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    expect(document.body.textContent).toContain("below WCAG AA");
  });

  it("renders a share box whose value equals encodeThemeCode(draft)", async () => {
    const screen = await render(<ThemeEditor target={{ mode: "create", baseId: "harbor" }} onClose={() => {}} />);
    const base = PRESET_BY_ID.get("harbor");
    const expected = encodeThemeCode({
      id: "ignored",
      name: `${base?.name} (copy)`,
      kind: "custom",
      base: "harbor",
      scheme: base?.scheme ?? "dark",
      tokens: { ...base?.tokens },
    });
    const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
    expect(box.value).toBe(expected);
  });

  it("Save adds the draft to customThemes and activates it", async () => {
    let closed = false;
    const screen = await render(
      <ThemeEditor
        target={{ mode: "create", baseId: DEFAULT_PRESET_ID }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await screen.getByRole("button", { name: "Save theme" }).click();
    const state = useThemeStore.getState();
    expect(state.customThemes.length).toBe(1);
    expect(state.activeThemeId).toBe(state.customThemes[0].id);
    expect(closed).toBe(true);
  });

  it("Discard closes without adding a custom theme", async () => {
    let closed = false;
    const screen = await render(
      <ThemeEditor
        target={{ mode: "create", baseId: DEFAULT_PRESET_ID }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await screen.getByRole("button", { name: "Discard" }).click();
    expect(useThemeStore.getState().customThemes.length).toBe(0);
    expect(closed).toBe(true);
  });

  it("keeps the share code in sync after editing a seed", async () => {
    const screen = await render(
      <ThemeEditor target={{ mode: "create", baseId: DEFAULT_PRESET_ID }} onClose={() => {}} />,
    );
    await fillVisibleHex("Accent hex", "#abcdef");
    const box = screen.getByLabelText("Theme share code").element() as HTMLTextAreaElement;
    await expect.poll(() => box.value.includes("abcdef")).toBe(true);
  });
});

describe("ThemeEditor edit mode", () => {
  const CUSTOM_ID = "custom-edit-1";

  function seedCustomTheme() {
    useThemeStore.setState({
      activeThemeId: CUSTOM_ID,
      customThemes: [
        {
          id: CUSTOM_ID,
          name: "Editable",
          kind: "custom",
          scheme: "dark",
          tokens: { bg: "#101010", text: "#ffffff", accent: "#ff8800" },
        },
      ],
    });
  }

  beforeEach(seedCustomTheme);

  it("initializes the draft from the existing theme, not a fork copy", async () => {
    const screen = await render(<ThemeEditor target={{ mode: "edit", themeId: CUSTOM_ID }} onClose={() => {}} />);
    expect(nameInput(screen).value).toBe("Editable");
  });

  it("labels the primary action 'Save changes' in edit mode", async () => {
    const screen = await render(<ThemeEditor target={{ mode: "edit", themeId: CUSTOM_ID }} onClose={() => {}} />);
    await expect.element(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("updates the existing theme in place without adding a new one", async () => {
    let closed = false;
    const screen = await render(
      <ThemeEditor
        target={{ mode: "edit", themeId: CUSTOM_ID }}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await fillVisibleHex("Accent hex", "#123456");
    await screen.getByRole("button", { name: "Save changes" }).click();
    const state = useThemeStore.getState();
    expect(state.customThemes.length).toBe(1);
    expect(state.customThemes[0].id).toBe(CUSTOM_ID);
    expect(state.customThemes[0].tokens.accent).toBe("#123456");
    expect(state.activeThemeId).toBe(CUSTOM_ID);
    expect(closed).toBe(true);
  });

  it("falls back to a fork when the edit target no longer exists", async () => {
    const screen = await render(<ThemeEditor target={{ mode: "edit", themeId: "gone" }} onClose={() => {}} />);
    const fallback = PRESET_BY_ID.get(DEFAULT_PRESET_ID);
    expect(nameInput(screen).value).toBe(`${fallback?.name} (copy)`);
  });
});
