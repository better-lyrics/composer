import { useSettingsStore } from "@/stores/settings";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import { describe, expect, it } from "vitest";

describe("ShortcutsSettingsSection", () => {
  it("renders every scope heading from the registry", async () => {
    const screen = await render(<ShortcutsSettingsSection />);
    await expect.element(screen.getByText("General")).toBeInTheDocument();
    await expect.element(screen.getByText("Sync Mode")).toBeInTheDocument();
    await expect.element(screen.getByText("Timeline Mode")).toBeInTheDocument();
    expect(screen.container.querySelector("input")).toBeNull();
  });

  it("lists the save shortcut with its default binding", async () => {
    const screen = await render(<ShortcutsSettingsSection />);
    await expect.element(screen.getByText("Save now", { exact: true })).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /^Change shortcut for Save now, currently/ }))
      .toBeInTheDocument();
  });

  it("disables 'Reset all' when there are no overrides", async () => {
    const screen = await render(<ShortcutsSettingsSection />);
    const resetButton = screen.getByRole("button", { name: /Reset all$/ });
    expect((resetButton.element() as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables 'Reset all' when at least one binding is overridden", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.help": { key: "x" } } });
    const screen = await render(<ShortcutsSettingsSection />);
    const resetButton = screen.getByRole("button", { name: /Reset all$/ });
    expect((resetButton.element() as HTMLButtonElement).disabled).toBe(false);
  });

  it("clears all overrides when Reset all is confirmed", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.help": { key: "x" } } });
    useSettingsStore.setState({ confirmResetShortcuts: false });
    const screen = await render(<ShortcutsSettingsSection />);
    await screen.getByRole("button", { name: /Reset all$/ }).click();
    expect(Object.keys(useShortcutBindingsStore.getState().overrides).length).toBe(0);
  });
});
