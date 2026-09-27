import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";

describe("useGlobalShortcuts", () => {
  it("switches to import on Mod+1", async () => {
    useProjectStore.setState({ activeTab: "preview" });
    const setActiveTab = (tab: string) => useProjectStore.setState({ activeTab: tab as never });
    await renderHook(() =>
      useGlobalShortcuts({
        setActiveTab,
        setHelpOpen: () => {},
        setSettingsOpen: () => {},
      }),
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", metaKey: true, ctrlKey: true, bubbles: true }));
    expect(useProjectStore.getState().activeTab).toBe("import");
  });

  it("opens help when the help shortcut is pressed", async () => {
    let helpOpen = false;
    await renderHook(() =>
      useGlobalShortcuts({
        setActiveTab: () => {},
        setHelpOpen: (open) => {
          helpOpen = open;
        },
        setSettingsOpen: () => {},
      }),
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }));
    expect(helpOpen).toBe(true);
  });
});

async function renderSettingsCounter(): Promise<{ count: () => number }> {
  let opened = 0;
  function GlobalHarness() {
    useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => opened++ });
    return null;
  }
  await render(<GlobalHarness />);
  return { count: () => opened };
}

describe("useGlobalShortcuts · remapped modifiers", () => {
  it("sibling: a global binding remapped to Mod+K does not fire on plain K", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "k", mod: true } } });
    let opened = 0;
    function GlobalHarness() {
      useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => opened++ });
      return null;
    }
    await render(<GlobalHarness />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true }));
    expect(opened).toBe(0);
  });

  it("fires a global binding remapped to Mod+K on Mod+K", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.settings": { key: "k", mod: true } } });
    const settings = await renderSettingsCounter();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }));
    expect(settings.count()).toBe(1);
  });

  it("does not fire a plain-key global shortcut while typing in an input", async () => {
    const settings = await renderSettingsCounter();
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: ",", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: ",", bubbles: true }));
      expect(settings.count()).toBe(1);
    } finally {
      input.remove();
    }
  });
});
