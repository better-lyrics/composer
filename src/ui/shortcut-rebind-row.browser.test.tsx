import { detectConflicts, getEffectiveBinding, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import type { ShortcutDefinition } from "@/stores/shortcut-registry";
import { render } from "@/test/render";
import { SettingsSearchQueryContext } from "@/ui/settings/settings-search-query";
import { Modal } from "@/ui/modal";
import { ShortcutRebindRow } from "@/ui/shortcut-rebind-row";
import { isMac } from "@/utils/platform";
import { findMatchingShortcut } from "@/utils/shortcut-matcher";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// Use an existing registry entry so `getEffectiveKeysArray` resolves it.
import { getShortcutById } from "@/stores/shortcut-registry";

const TEST_SHORTCUT: ShortcutDefinition = getShortcutById("global.help") as ShortcutDefinition;
const RECORDING_TEXT = "Press keys\u2026";

async function openCapture(screen: Awaited<ReturnType<typeof render>>) {
  await screen.getByRole("button", { name: /^Change shortcut for/ }).click();
  await expect.element(screen.getByText(RECORDING_TEXT)).toBeInTheDocument();
}

describe("ShortcutRebindRow", () => {
  it("renders the description and default binding", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await expect.element(screen.getByText(TEST_SHORTCUT.description)).toBeInTheDocument();
  });

  it("records in the row when the binding button is clicked", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await openCapture(screen);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("Escape ends recording without closing Settings or persisting an override", async () => {
    let settingsClosed = false;
    const screen = await render(
      <Modal
        isOpen
        onClose={() => {
          settingsClosed = true;
        }}
        title="Settings"
      >
        <ShortcutRebindRow definition={TEST_SHORTCUT} />
      </Modal>,
    );
    await openCapture(screen);
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByText(RECORDING_TEXT)).not.toBeInTheDocument();
    expect(settingsClosed).toBe(false);
    expect(TEST_SHORTCUT.id in useShortcutBindingsStore.getState().overrides).toBe(false);
  });

  it("persists a new binding when a non-conflicting key is pressed", async () => {
    const screen = await render(<ShortcutRebindRow definition={TEST_SHORTCUT} />);
    await openCapture(screen);
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

function bindingButton(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByRole("button", { name: /^Change shortcut for/ });
}

describe("capturing a new key combination", () => {
  it("U5: Use here leaves no other shortcut on the same key", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    await userEvent.keyboard("p");
    await expect.element(screen.getByText(/is already used by/)).toBeInTheDocument();
    await screen.getByRole("button", { name: "Use P here" }).click();

    expect(detectConflicts(FOLLOW.id, getEffectiveBinding(FOLLOW.id)).map((d) => d.id)).toEqual([]);
  });

  it("lowercase badge: a clash shows the key uppercased like every other badge", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    await userEvent.keyboard("p");
    await expect.element(screen.getByText(/is already used by/)).toBeInTheDocument();
    expect(bindingButton(screen).element().textContent).toBe("P");
  });

  it("Keep ends a clash without changing either shortcut", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    await userEvent.keyboard("p");
    await screen.getByRole("button", { name: /^Keep / }).click();
    await expect.element(screen.getByText(/is already used by/)).not.toBeInTheDocument();
    expect(useShortcutBindingsStore.getState().overrides).toEqual({});
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
    await expect.element(screen.getByText(RECORDING_TEXT)).toBeInTheDocument();
  });

  it("browser warning badge shows the key uppercased", async () => {
    const screen = await render(<ShortcutRebindRow definition={FOLLOW} />);
    await openCapture(screen);
    const modifier = isMac ? { metaKey: true } : { ctrlKey: true };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", code: "KeyT", ...modifier, bubbles: true }));
    await expect.element(screen.getByText(/may be taken by the browser/)).toBeInTheDocument();
    expect(bindingButton(screen).element().lastElementChild?.textContent).toBe("T");
  });

  it("regression: re-recording the default save binding shows no browser warning", async () => {
    const saveNow = getShortcutById("global.saveNow") as ShortcutDefinition;
    const screen = await render(<ShortcutRebindRow definition={saveNow} />);
    await openCapture(screen);
    const modifier = isMac ? { metaKey: true } : { ctrlKey: true };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS", ...modifier, bubbles: true }));
    await expect.element(screen.getByText(RECORDING_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(/may be taken by the browser/).elements()).toHaveLength(0);
    expect(getEffectiveBinding(saveNow.id)).toEqual(saveNow.defaultBinding);
  });
});
