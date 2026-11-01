import { createRef } from "react";
import { describe, expect, it, onTestFinished } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createLine } from "@/test/factories";
import { isMac } from "@/utils/platform";
import { useTimelineKeyboard } from "@/views/timeline/use-timeline-keyboard";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };
const OTHER_COMMAND_KEY = { metaKey: !isMac, ctrlKey: isMac };

// -- Helpers ------------------------------------------------------------------

function press(init: KeyboardEventInit, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function renderWithTwoAgentChanges(): Promise<void> {
  useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world" })], activeTab: "timeline" });
  const scrollContainerRef = createRef<HTMLDivElement | null>();
  await renderHook(() => useTimelineKeyboard(scrollContainerRef, [], 0));
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v2" });
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v3" });
}

function agentId(): string | undefined {
  return useProjectStore.getState().lines[0].agentId;
}

// -- Tests --------------------------------------------------------------------

describe("useTimelineKeyboard undo and redo", () => {
  it("undoes on Mod+Z and redoes on Mod+Shift+Z", async () => {
    await renderWithTwoAgentChanges();

    expect(press({ key: "z", code: "KeyZ", ...MOD }).defaultPrevented).toBe(true);
    expect(agentId()).toBe("v2");

    press({ key: "Z", code: "KeyZ", ...MOD, shiftKey: true });
    expect(agentId()).toBe("v3");
  });

  it("undoes and redoes on remapped bindings", async () => {
    useShortcutBindingsStore.setState({
      overrides: { "global.undo": { key: "b", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
    });
    await renderWithTwoAgentChanges();

    press({ key: "b", code: "KeyB", ...MOD });
    expect(agentId()).toBe("v2");

    press({ key: "r", code: "KeyR", ...MOD, altKey: true });
    expect(agentId()).toBe("v3");
  });

  it.skipIf(isMac)("redoes on the Ctrl+Y alternate redo", async () => {
    await renderWithTwoAgentChanges();
    press({ key: "z", code: "KeyZ", ...MOD });

    press({ key: "y", code: "KeyY", ...MOD });

    expect(agentId()).toBe("v3");
  });

  describe("keys that worked before undo and redo were remappable", () => {
    it("keeps Mod+Z undoing after undo is remapped", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });
      await renderWithTwoAgentChanges();

      press({ key: "z", code: "KeyZ", ...MOD });

      expect(agentId()).toBe("v2");
    });

    it("undoes and redoes with the other command key held", async () => {
      await renderWithTwoAgentChanges();

      press({ key: "z", code: "KeyZ", ...OTHER_COMMAND_KEY });
      expect(agentId()).toBe("v2");

      press({ key: "Z", code: "KeyZ", ...OTHER_COMMAND_KEY, shiftKey: true });
      expect(agentId()).toBe("v3");
    });

    it("undoes on the physical Z key under a non-Latin layout", async () => {
      await renderWithTwoAgentChanges();

      press({ key: "я", code: "KeyZ", ...MOD });

      expect(agentId()).toBe("v2");
    });
  });

  describe("regressions", () => {
    it("regression: a held undo key undoes once and consumes the repeats", async () => {
      await renderWithTwoAgentChanges();

      press({ key: "z", code: "KeyZ", ...MOD });
      const held = press({ key: "z", code: "KeyZ", ...MOD, repeat: true });

      expect(held.defaultPrevented).toBe(true);
      expect(agentId()).toBe("v2");
    });
  });

  describe("edge cases", () => {
    it("leaves undo inside a text input to the input", async () => {
      await renderWithTwoAgentChanges();
      const input = document.createElement("input");
      document.body.appendChild(input);
      onTestFinished(() => input.remove());
      input.focus();

      const event = press({ key: "z", code: "KeyZ", ...MOD }, input);

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v3");
    });

    it("yields Mod+Z to a shortcut the user bound to it in this scope", async () => {
      useShortcutBindingsStore.setState({
        overrides: { "global.undo": { key: "" }, "timeline.toggleFollow": { key: "z", mod: true } },
      });
      await renderWithTwoAgentChanges();

      press({ key: "z", code: "KeyZ", ...MOD });

      expect(agentId()).toBe("v3");
    });

    it.runIf(isMac)("leaves Cmd+Y alone on macOS, as before", async () => {
      await renderWithTwoAgentChanges();
      press({ key: "z", code: "KeyZ", ...MOD });
      expect(agentId()).toBe("v2");

      const event = press({ key: "y", code: "KeyY", ...MOD });

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v2");
    });
  });
});
