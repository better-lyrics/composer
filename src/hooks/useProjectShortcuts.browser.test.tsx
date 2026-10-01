import { useProjectShortcuts } from "@/hooks/useProjectShortcuts";
import { restoreOpenProject } from "@/lib/open-project";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { assignBinding } from "@/stores/shortcut-bindings";
import { useUIStore } from "@/stores/ui";
import { seedStoredProject } from "@/test/projects";
import { isMac } from "@/utils/platform";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

// -- Helpers ------------------------------------------------------------------

function pressWithMod(key: string, code: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    bubbles: true,
    cancelable: true,
    metaKey: isMac,
    ctrlKey: !isMac,
    ...extra,
  });
  window.dispatchEvent(event);
  return event;
}

// -- Tests --------------------------------------------------------------------

describe("useProjectShortcuts", () => {
  it("Mod+O opens the project switcher and keeps the browser's open-file dialog away", async () => {
    await renderHook(() => useProjectShortcuts());
    const event = pressWithMod("o", "KeyO");
    expect(useUIStore.getState().projectSwitcherOpen).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Mod+Alt+N starts a new project", async () => {
    await seedStoredProject("a", { open: true });
    await restoreOpenProject();
    await renderHook(() => useProjectShortcuts());
    const event = pressWithMod(isMac ? "˜" : "n", "KeyN", { altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(openProjectIdSnapshot()).not.toBe("a");
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  describe("edge cases", () => {
    it("does nothing while a modal is open", async () => {
      useModalStackStore.setState({ stack: Array.from({ length: 1 }, () => Symbol("modal")) });
      await renderHook(() => useProjectShortcuts());
      const event = pressWithMod("o", "KeyO");
      expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });

    it("ignores key repeats", async () => {
      await renderHook(() => useProjectShortcuts());
      pressWithMod("o", "KeyO", { repeat: true });
      expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
    });

    it("follows a remapped binding", async () => {
      assignBinding("global.openProjectSwitcher", { key: "p", mod: true });
      await renderHook(() => useProjectShortcuts());
      pressWithMod("o", "KeyO");
      expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
      pressWithMod("p", "KeyP");
      expect(useUIStore.getState().projectSwitcherOpen).toBe(true);
    });

    it("plain O without the modifier does nothing", async () => {
      await renderHook(() => useProjectShortcuts());
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "o", code: "KeyO", bubbles: true }));
      expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
    });

    it("does nothing while disabled", async () => {
      await renderHook(() => useProjectShortcuts(false));
      const event = pressWithMod("o", "KeyO");
      expect(useUIStore.getState().projectSwitcherOpen).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
