import { detectConflicts, getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import type { ShortcutDefinition } from "@/stores/shortcut-registry";
import { render } from "@/test/render";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";
import { isMac } from "@/utils/platform";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

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

  it("names the rebind button by the action and its current keys", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await expect
      .element(screen.getByRole("button", { name: "Change shortcut for Show help, currently Shift+?" }))
      .toBeInTheDocument();
  });

  it("spells the platform modifier in the rebind button name", async () => {
    useShortcutBindingsStore.setState({ overrides: { [TEST_SHORTCUT.id]: { key: "k", mod: true } } });
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    const modifier = isMac ? "Cmd" : "Ctrl";
    await expect
      .element(screen.getByRole("button", { name: `Change shortcut for Show help, currently ${modifier}+K` }))
      .toBeInTheDocument();
  });

  it("names an unbound shortcut's rebind button as Unbound", async () => {
    useShortcutBindingsStore.setState({ overrides: { [TEST_SHORTCUT.id]: { key: "" } } });
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await expect
      .element(screen.getByRole("button", { name: "Change shortcut for Show help, currently Unbound" }))
      .toBeInTheDocument();
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

const FOLLOW = getShortcutById("timeline.toggleFollow") as ShortcutDefinition;

async function openCapture(screen: Awaited<ReturnType<typeof render>>) {
  screen.container.querySelectorAll("button")[0]?.click();
  await expect.element(screen.getByText("Press a new key combination")).toBeInTheDocument();
}

describe("capturing a new key combination", () => {
  it("U5: Replace leaves no other shortcut on the same key", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    await userEvent.keyboard("p");
    await expect.element(screen.getByText("is already used by:")).toBeInTheDocument();
    await screen.getByRole("button", { name: "Replace" }).click();

    expect(detectConflicts(FOLLOW.id, getEffectiveBinding(FOLLOW.id)).map((d) => d.id)).toEqual([]);
  });

  it("lowercase badge: conflict modal shows the key uppercased like every other badge", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    await userEvent.keyboard("p");
    await expect.element(screen.getByText("is already used by:")).toBeInTheDocument();
    const badgeText = document.querySelector("dialog span.inline-flex > span")?.textContent;
    expect(badgeText).toBe("P");
  });

  it("sibling: an Alt binding recorded on macOS matches the same key press afterwards", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    const init = { key: "\u00b4", code: "KeyE", altKey: true, bubbles: true };
    window.dispatchEvent(new KeyboardEvent("keydown", init));
    expect(findMatchingShortcut(new KeyboardEvent("keydown", init), "timeline")).toBe(FOLLOW.id);
  });

  it.each(["Unidentified", "Dead", "Process"])("U6: recorder ignores non-bindable key %s", async (key) => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(useShortcutBindingsStore.getState().overrides[FOLLOW.id]).toBeUndefined();
  });

  it("U6: recorder keeps listening after a non-bindable key", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Dead", bubbles: true }));
    await expect.element(screen.getByText("Press a new key combination")).toBeInTheDocument();
  });

  it("browser warning badge shows the key uppercased", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    const modifier = isMac ? { metaKey: true } : { ctrlKey: true };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", code: "KeyT", ...modifier, bubbles: true }));
    await expect.element(screen.getByText("may be reserved by the browser.")).toBeInTheDocument();
    const badges = Array.from(document.querySelectorAll("dialog span.inline-flex > span")).map((el) => el.textContent);
    expect(badges.at(-1)).toBe("T");
  });
});
