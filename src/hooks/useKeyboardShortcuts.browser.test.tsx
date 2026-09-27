import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";

describe("useKeyboardShortcuts", () => {
  it("invokes the action when the matching key is pressed", async () => {
    let count = 0;
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "z" } } });
    await renderHook(() => useKeyboardShortcuts({ "global.settings": () => count++ }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(count).toBe(1);
  });

  it("does NOT invoke the action when modifiers differ", async () => {
    let count = 0;
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "z", shift: true } } });
    await renderHook(() => useKeyboardShortcuts({ "global.settings": () => count++ }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(count).toBe(0);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", shiftKey: true, bubbles: true }));
    expect(count).toBe(1);
  });

  it("does not register handlers when enabled=false", async () => {
    let count = 0;
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "z" } } });
    await renderHook(() => useKeyboardShortcuts({ "global.settings": () => count++ }, { enabled: false }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(count).toBe(0);
  });

  it("ignores keydown events flagged as repeat (OS auto-repeat / stuck key)", async () => {
    let count = 0;
    useShortcutBindingsStore.setState({ overrides: { "global.playPause": { key: " " } } });
    await renderHook(() => useKeyboardShortcuts({ "global.playPause": () => count++ }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(count).toBe(1);
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true }));
    }
    expect(count).toBe(1);
  });

  it("follows a binding changed after mount", async () => {
    let count = 0;
    await renderHook(() => useKeyboardShortcuts({ "global.settings": () => count++ }));
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "z" } } });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(count).toBe(1);
  });

  it("regression: calls the latest action and enabled flag after a rerender", async () => {
    const calls: string[] = [];
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "z" } } });
    const { rerender } = await renderHook(
      (props?: { tag: string; enabled: boolean }) =>
        useKeyboardShortcuts({ "global.settings": () => calls.push(props?.tag ?? "") }, { enabled: props?.enabled }),
      { initialProps: { tag: "first", enabled: true } },
    );
    await rerender({ tag: "second", enabled: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    await rerender({ tag: "third", enabled: false });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(calls).toEqual(["second"]);
  });

  it("does nothing for a matched shortcut that has no action", async () => {
    let count = 0;
    await renderHook(() => useKeyboardShortcuts({ "global.settings": () => count++ }));
    const event = new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(count).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
