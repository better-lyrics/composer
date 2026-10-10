import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { EditPanel } from "@/views/edit";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };
const OTHER_COMMAND_KEY = { metaKey: !isMac, ctrlKey: isMac };

// -- Helpers ------------------------------------------------------------------

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function renderWithTwoAgentChanges(): Promise<HTMLTextAreaElement> {
  useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello" })] });
  const screen = await render(<EditPanel />);
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v2" });
  useProjectStore.getState().updateLineWithHistory("l1", { agentId: "v3" });
  await expect.poll(() => useProjectStore.getState().lines[0].agentId).toBe("v3");
  return screen.container.querySelector("textarea") as HTMLTextAreaElement;
}

function agentId(): string | undefined {
  return useProjectStore.getState().lines[0].agentId;
}

// -- Tests --------------------------------------------------------------------

beforeEach(() => {
  useProjectStore.setState({ activeTab: "edit" });
});

describe("Edit undo and redo shortcuts", () => {
  it("undoes and redoes on remapped bindings", async () => {
    useShortcutBindingsStore.setState({
      overrides: { "global.undo": { key: "b", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
    });
    await renderWithTwoAgentChanges();

    press(window, { key: "b", code: "KeyB", ...MOD });
    await expect.poll(agentId).toBe("v2");

    press(window, { key: "r", code: "KeyR", ...MOD, altKey: true });
    await expect.poll(agentId).toBe("v3");
  });

  it("yields Mod+Z to a shortcut the user bound to it", async () => {
    useShortcutBindingsStore.setState({
      overrides: { "global.undo": { key: "" }, "global.goToSync": { key: "z", mod: true } },
    });
    await renderWithTwoAgentChanges();

    const event = press(window, { key: "z", code: "KeyZ", ...MOD });

    expect(event.defaultPrevented).toBe(false);
    expect(agentId()).toBe("v3");
  });

  describe("keys that worked before undo and redo were remappable", () => {
    it("keeps Mod+Z undoing after undo is remapped", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });
      await renderWithTwoAgentChanges();

      press(window, { key: "z", code: "KeyZ", ...MOD });

      await expect.poll(agentId).toBe("v2");
    });

    it("undoes and redoes with the other command key held", async () => {
      await renderWithTwoAgentChanges();

      press(window, { key: "z", code: "KeyZ", ...OTHER_COMMAND_KEY });
      await expect.poll(agentId).toBe("v2");

      press(window, { key: "Z", code: "KeyZ", ...OTHER_COMMAND_KEY, shiftKey: true });
      await expect.poll(agentId).toBe("v3");
    });

    it("redoes on Y with either command key", async () => {
      await renderWithTwoAgentChanges();
      press(window, { key: "z", code: "KeyZ", ...MOD });
      press(window, { key: "z", code: "KeyZ", ...MOD });
      await expect.poll(agentId).toBe("v1");

      press(window, { key: "y", code: "KeyY", ...MOD });
      await expect.poll(agentId).toBe("v2");

      press(window, { key: "y", code: "KeyY", ...OTHER_COMMAND_KEY });
      await expect.poll(agentId).toBe("v3");
    });

    it("undoes on the physical Z key under a non-Latin layout", async () => {
      await renderWithTwoAgentChanges();

      press(window, { key: "я", code: "KeyZ", ...MOD });

      await expect.poll(agentId).toBe("v2");
    });

    it("keeps undoing while the undo key is held", async () => {
      const textarea = await renderWithTwoAgentChanges();
      textarea.focus();

      press(textarea, { key: "z", code: "KeyZ", ...MOD });
      await expect.poll(agentId).toBe("v2");
      const held = press(textarea, { key: "z", code: "KeyZ", ...MOD, repeat: true });

      expect(held.defaultPrevented).toBe(true);
      await expect.poll(agentId).toBe("v1");
    });
  });

  describe("edge cases", () => {
    it("types a plain-key undo binding into the lyrics textarea instead of undoing", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b" } } });
      const textarea = await renderWithTwoAgentChanges();
      textarea.focus();

      const event = press(textarea, { key: "b", code: "KeyB" });

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v3");
    });

    it("undoes on a plain-key binding when focus is outside the textarea", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b" } } });
      await renderWithTwoAgentChanges();
      document.body.focus();

      press(window, { key: "b", code: "KeyB" });

      await expect.poll(agentId).toBe("v2");
    });
  });
});
