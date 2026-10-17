import { describe, expect, it } from "vitest";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";
import { UndoHint } from "@/ui/undo-hint";

describe("UndoHint", () => {
  it("names the default undo keys", async () => {
    const screen = await render(<UndoHint />);

    await expect.element(screen.getByText(/This can be undone with/)).toBeInTheDocument();
    expect(screen.container.querySelector("[data-inline-key-badge]")?.textContent).toMatch(/Z$/);
  });

  it("names the user's undo binding after a remap", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });
    const screen = await render(<UndoHint />);

    await expect.element(screen.getByText(/This can be undone with/)).toBeInTheDocument();
    expect(screen.container.querySelector("[data-inline-key-badge]")?.textContent).toMatch(/B$/);
  });

  describe("edge cases", () => {
    it("drops the key when undo is unbound", async () => {
      useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "" } } });
      const screen = await render(<UndoHint />);

      await expect.element(screen.getByText("This can be undone.")).toBeInTheDocument();
      expect(screen.container.querySelector("[data-inline-key-badge]")).toBeNull();
    });
  });
});
