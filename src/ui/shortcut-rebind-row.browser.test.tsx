import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import type { ShortcutDefinition } from "@/stores/shortcut-registry";
import { render } from "@/test/render";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";

// Use an existing registry entry so `getEffectiveKeysArray` resolves it.
import { getShortcutById } from "@/stores/shortcut-registry";

const TEST_SHORTCUT: ShortcutDefinition = getShortcutById("global.help") as ShortcutDefinition;

describe("ShortcutRebindRow", () => {
  it("renders the description and default binding", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await expect.element(screen.getByText(TEST_SHORTCUT.description)).toBeInTheDocument();
  });

  it("opens the capture modal when the binding button is clicked", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    const triggerButton = screen.container.querySelectorAll("button")[0];
    triggerButton?.click();
    await expect.element(screen.getByText("Press a new key combination")).toBeInTheDocument();
  });

  it("closes the capture modal on Escape without persisting an override", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    const triggerButton = screen.container.querySelectorAll("button")[0];
    triggerButton?.click();
    await expect.element(screen.getByText("Press a new key combination")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(TEST_SHORTCUT.id in useShortcutBindingsStore.getState().overrides).toBe(false);
  });

  it("persists a new binding when a non-conflicting key is pressed", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    const triggerButton = screen.container.querySelectorAll("button")[0];
    triggerButton?.click();
    await expect.element(screen.getByText("Press a new key combination")).toBeInTheDocument();
    await userEvent.keyboard("q");
    expect(useShortcutBindingsStore.getState().overrides[TEST_SHORTCUT.id]?.key).toBe("q");
  });

  it("shows a Reset button after the binding is overridden and clears the override on click", async () => {
    useShortcutBindingsStore.setState({ overrides: { [TEST_SHORTCUT.id]: { key: "q" } } });
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    const reset = screen.getByRole("button", { name: "Reset" });
    await reset.click();
    expect(TEST_SHORTCUT.id in useShortcutBindingsStore.getState().overrides).toBe(false);
  });

  describe("inside settings search", () => {
    it("underlines the matched words in its description", async () => {
      const screen = await render(
        <SettingsSearchQueryContext value="help">
          <ShortcutRebindRow definition={TEST_SHORTCUT} />
        </SettingsSearchQueryContext>,
      );
      const marks = [...screen.container.querySelectorAll("mark")].map((mark) => mark.textContent?.toLowerCase());
      expect(marks.length).toBeGreaterThan(0);
      expect(marks.every((mark) => mark === "help")).toBe(true);
    });

    it("marks nothing outside search", async () => {
      const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
      expect(screen.container.querySelector("mark")).toBeNull();
    });
  });
});
