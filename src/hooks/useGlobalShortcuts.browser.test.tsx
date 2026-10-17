import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { isCountingIn } from "@/lib/sync-count-in";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

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

  it("leaves tab shortcuts alone outside the editor but still opens help", async () => {
    useProjectStore.setState({ activeTab: "preview" });
    let helpOpen = false;
    await renderHook(() =>
      useGlobalShortcuts({
        setActiveTab: (tab) => useProjectStore.setState({ activeTab: tab }),
        setHelpOpen: (open) => {
          helpOpen = open;
        },
        setSettingsOpen: () => {},
        editorActive: false,
      }),
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", metaKey: true, ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }));
    expect(useProjectStore.getState().activeTab).toBe("preview");
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

describe("useGlobalShortcuts · play/pause in Sync", () => {
  function pressEnter(): void {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  async function renderInSync(): Promise<void> {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, isPlaying: false });
    useProjectStore.setState({ activeTab: "sync" });
    useSettingsStore.setState({ syncCountIn: 3 });
    await renderHook(() =>
      useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} }),
    );
  }

  it("counts in on Enter", async () => {
    await renderInSync();
    pressEnter();
    expect(isCountingIn()).toBe(true);
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });

  it("cancels the count on a second Enter", async () => {
    await renderInSync();
    pressEnter();
    pressEnter();
    expect(isCountingIn()).toBe(false);
    expect(useAudioStore.getState().isPlaying).toBe(false);
  });
});

async function renderEditorShortcuts(): Promise<void> {
  await renderHook(() =>
    useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} }),
  );
}

function pressSpeedToggle(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "R", shiftKey: true, bubbles: true }));
}

describe("useGlobalShortcuts · playback speed toggle", () => {
  it("drops normal speed to 0.75x on Shift+R", async () => {
    useAudioStore.setState({ playbackRate: 1 });
    await renderEditorShortcuts();
    pressSpeedToggle();
    expect(useAudioStore.getState().playbackRate).toBe(0.75);
  });

  it("returns 0.75x to normal speed on Shift+R", async () => {
    useAudioStore.setState({ playbackRate: 0.75 });
    await renderEditorShortcuts();
    pressSpeedToggle();
    expect(useAudioStore.getState().playbackRate).toBe(1);
  });

  it("toggles back and forth on repeated presses", async () => {
    useAudioStore.setState({ playbackRate: 1 });
    await renderEditorShortcuts();
    pressSpeedToggle();
    pressSpeedToggle();
    pressSpeedToggle();
    expect(useAudioStore.getState().playbackRate).toBe(0.75);
  });

  describe("edge cases", () => {
    it("returns any other speed to normal speed", async () => {
      useAudioStore.setState({ playbackRate: 1.5 });
      await renderEditorShortcuts();
      pressSpeedToggle();
      expect(useAudioStore.getState().playbackRate).toBe(1);
    });

    it("does not toggle outside the editor", async () => {
      useAudioStore.setState({ playbackRate: 1 });
      await renderHook(() =>
        useGlobalShortcuts({
          setActiveTab: () => {},
          setHelpOpen: () => {},
          setSettingsOpen: () => {},
          editorActive: false,
        }),
      );
      pressSpeedToggle();
      expect(useAudioStore.getState().playbackRate).toBe(1);
    });

    it("does not toggle while typing in a field", async () => {
      useAudioStore.setState({ playbackRate: 1 });
      await renderEditorShortcuts();
      const input = document.createElement("input");
      document.body.appendChild(input);
      try {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "R", shiftKey: true, bubbles: true }));
        expect(useAudioStore.getState().playbackRate).toBe(1);
      } finally {
        input.remove();
      }
    });
  });
});
