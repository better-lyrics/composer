import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { SyncPanel } from "@/views/sync/sync-panel";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };

// -- Helpers ------------------------------------------------------------------

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

async function renderWithTwoAgentChanges(): Promise<void> {
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60, isPlaying: false });
  useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world" })], activeTab: "sync" });
  await render(<SyncPanel />);
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v2" });
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v3" });
  await expect.poll(agentId).toBe("v3");
}

function agentId(): string | undefined {
  return useProjectStore.getState().lines[0].agentId;
}

// -- Tests --------------------------------------------------------------------

describe("SyncPanel undo and redo shortcuts", () => {
  it("undoes on Mod+Z and redoes on Mod+Shift+Z", async () => {
    await renderWithTwoAgentChanges();

    expect(press({ key: "z", code: "KeyZ", ...MOD }).defaultPrevented).toBe(true);
    await expect.poll(agentId).toBe("v2");

    press({ key: "Z", code: "KeyZ", ...MOD, shiftKey: true });
    await expect.poll(agentId).toBe("v3");
  });

  it("undoes and redoes on remapped bindings", async () => {
    useShortcutBindingsStore.setState({
      overrides: { "global.undo": { key: "u", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
    });
    await renderWithTwoAgentChanges();

    press({ key: "u", code: "KeyU", ...MOD });
    await expect.poll(agentId).toBe("v2");

    press({ key: "r", code: "KeyR", ...MOD, altKey: true });
    await expect.poll(agentId).toBe("v3");
  });

  it.skipIf(isMac)("redoes on the Ctrl+Y alternate redo", async () => {
    await renderWithTwoAgentChanges();
    press({ key: "z", code: "KeyZ", ...MOD });
    await expect.poll(agentId).toBe("v2");

    press({ key: "y", code: "KeyY", ...MOD });

    await expect.poll(agentId).toBe("v3");
  });

  describe("regressions", () => {
    it("regression: a held undo key undoes once and consumes the repeats", async () => {
      await renderWithTwoAgentChanges();

      press({ key: "z", code: "KeyZ", ...MOD });
      await expect.poll(agentId).toBe("v2");
      const held = press({ key: "z", code: "KeyZ", ...MOD, repeat: true });

      expect(held.defaultPrevented).toBe(true);
      expect(agentId()).toBe("v2");
    });
  });

  describe("edge cases", () => {
    it("leaves the old Mod+Z to the browser once undo is remapped", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "u", mod: true } } });
      await renderWithTwoAgentChanges();

      const event = press({ key: "z", code: "KeyZ", ...MOD });

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v3");
    });
  });
});
