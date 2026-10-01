import { useChoiceStore } from "@/stores/choice-store";
import { useSettingsStore } from "@/stores/settings";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { askWordDivergence } from "@/ui/divergence-prompt";
import { beforeEach, describe, expect, it } from "vitest";

// -- Tests --------------------------------------------------------------------

describe("askWordDivergence", () => {
  beforeEach(() => {
    useSettingsStore.setState({ linkedDivergenceAction: "ask" });
  });

  it("opens with the group label and sibling count", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 3, groupLabel: "Chorus" });
    await expect.element(screen.getByRole("heading", { name: "Word structure changed" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("Chorus");
    expect(document.body.textContent).toContain("3 other instances");
    useChoiceStore.getState().answer("cancel");
    await result;
  });

  it("names this group when the group has no label", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await expect.element(screen.getByRole("heading", { name: "Word structure changed" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("this group");
    useChoiceStore.getState().answer("cancel");
    await result;
  });

  it("pluralizes singular sibling count correctly", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 1 });
    await expect.element(screen.getByRole("heading", { name: "Word structure changed" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("1 other instance");
    expect(document.body.textContent).not.toContain("1 other instances");
    useChoiceStore.getState().answer("cancel");
    await result;
  });

  // -- Resolution -------------------------------------------------------------

  it("resolves with 'apply' when Apply to all is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByRole("button", { name: "Apply to all" }).click();
    expect(await result).toBe("apply");
  });

  it("resolves with 'detach' when Detach is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByRole("button", { name: "Detach" }).click();
    expect(await result).toBe("detach");
  });

  it("resolves with 'cancel' when Cancel is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await result).toBe("cancel");
  });

  // -- Saved preference -------------------------------------------------------

  it("auto-resolves to 'apply' without a prompt when the preference is 'apply'", async () => {
    useSettingsStore.setState({ linkedDivergenceAction: "apply" });
    expect(await askWordDivergence({ affectedSiblingCount: 1 })).toBe("apply");
    expect(useChoiceStore.getState().request).toBeNull();
  });

  it("auto-resolves to 'detach' without a prompt when the preference is 'detach'", async () => {
    useSettingsStore.setState({ linkedDivergenceAction: "detach" });
    expect(await askWordDivergence({ affectedSiblingCount: 1 })).toBe("detach");
    expect(useChoiceStore.getState().request).toBeNull();
  });

  // -- Don't ask again --------------------------------------------------------

  it("persists 'apply' as the new default when 'Don't ask again' is checked and Apply is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByLabelText(/Don't ask again/).click();
    await screen.getByRole("button", { name: "Apply to all" }).click();
    expect(await result).toBe("apply");
    expect(useSettingsStore.getState().linkedDivergenceAction).toBe("apply");
  });

  it("persists 'detach' as the new default when 'Don't ask again' is checked and Detach is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByLabelText(/Don't ask again/).click();
    await screen.getByRole("button", { name: "Detach" }).click();
    expect(await result).toBe("detach");
    expect(useSettingsStore.getState().linkedDivergenceAction).toBe("detach");
  });

  it("does not persist a preference when 'Don't ask again' is left unchecked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByRole("button", { name: "Apply to all" }).click();
    expect(await result).toBe("apply");
    expect(useSettingsStore.getState().linkedDivergenceAction).toBe("ask");
  });

  it("does NOT persist a preference when 'Don't ask again' is checked but Cancel is clicked", async () => {
    const screen = await render(<ChoiceModalHost />);
    const result = askWordDivergence({ affectedSiblingCount: 2 });
    await screen.getByLabelText(/Don't ask again/).click();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await result).toBe("cancel");
    expect(useSettingsStore.getState().linkedDivergenceAction).toBe("ask");
  });

  describe("edge cases", () => {
    it("cancels a second prompt while one is showing", async () => {
      allowConsole(/a choice prompt is already open/);
      await render(<ChoiceModalHost />);
      const first = askWordDivergence({ affectedSiblingCount: 1 });
      expect(await askWordDivergence({ affectedSiblingCount: 1 })).toBe("cancel");
      useChoiceStore.getState().answer("apply");
      expect(await first).toBe("apply");
    });
  });
});
