import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { isMac } from "@/utils/platform";
import { EditPanel } from "@/views/edit";

// -- Constants ----------------------------------------------------------------

const MOD = { metaKey: isMac, ctrlKey: !isMac };

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
      overrides: { "global.undo": { key: "u", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
    });
    await renderWithTwoAgentChanges();

    press(window, { key: "u", code: "KeyU", ...MOD });
    await expect.poll(agentId).toBe("v2");

    press(window, { key: "r", code: "KeyR", ...MOD, altKey: true });
    await expect.poll(agentId).toBe("v3");
  });

  it("leaves the old Mod+Z to the browser once undo is remapped", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "u", mod: true } } });
    await renderWithTwoAgentChanges();

    const event = press(window, { key: "z", code: "KeyZ", ...MOD });

    expect(event.defaultPrevented).toBe(false);
    expect(agentId()).toBe("v3");
  });

  it.runIf(isMac)("does not redo on Cmd+Y on macOS", async () => {
    await renderWithTwoAgentChanges();
    press(window, { key: "z", code: "KeyZ", ...MOD });
    await expect.poll(agentId).toBe("v2");

    const event = press(window, { key: "y", code: "KeyY", ...MOD });

    expect(event.defaultPrevented).toBe(false);
    expect(agentId()).toBe("v2");
  });

  describe("regressions", () => {
    it("regression: a held undo key undoes once and still blocks the native textarea undo", async () => {
      const textarea = await renderWithTwoAgentChanges();
      textarea.focus();

      press(textarea, { key: "z", code: "KeyZ", ...MOD });
      await expect.poll(agentId).toBe("v2");
      const held = press(textarea, { key: "z", code: "KeyZ", ...MOD, repeat: true });

      expect(held.defaultPrevented).toBe(true);
      expect(agentId()).toBe("v2");
    });
  });

  describe("edge cases", () => {
    it("types a plain-key undo binding into the lyrics textarea instead of undoing", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "u" } } });
      const textarea = await renderWithTwoAgentChanges();
      textarea.focus();

      const event = press(textarea, { key: "u", code: "KeyU" });

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v3");
    });

    it("undoes on a plain-key binding when focus is outside the textarea", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "u" } } });
      await renderWithTwoAgentChanges();
      document.body.focus();

      press(window, { key: "u", code: "KeyU" });

      await expect.poll(agentId).toBe("v2");
    });

    it("does nothing on Mod+Z while undo is unbound", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "" } } });
      await renderWithTwoAgentChanges();

      const event = press(window, { key: "z", code: "KeyZ", ...MOD });

      expect(event.defaultPrevented).toBe(false);
      expect(agentId()).toBe("v3");
    });
  });
});
