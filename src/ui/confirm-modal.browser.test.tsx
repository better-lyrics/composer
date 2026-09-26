import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { useConfirmStore } from "@/stores/confirm-store";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";

describe("ConfirmModalHost", () => {
  it("renders nothing when the store has no active confirm", async () => {
    await render(<ConfirmModalHost />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the supplied title and description when the store opens a confirm", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "Delete project?", description: "This wipes everything." });
    await expect.element(screen.getByRole("heading", { name: "Delete project?" })).toBeInTheDocument();
    await expect.element(screen.getByText("This wipes everything.")).toBeInTheDocument();
  });

  it("resolves with true when Confirm is clicked", async () => {
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "OK?" });
    await screen.getByRole("button", { name: "Confirm" }).click();
    expect(await result).toBe(true);
  });

  it("resolves with false when Cancel is clicked", async () => {
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "OK?" });
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await result).toBe(false);
  });

  // -- Initial focus ----------------------------------------------------------

  it("focuses the confirm button of a primary confirm", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "Split all?", confirmLabel: "Split", variant: "primary" });
    await expect.element(screen.getByRole("button", { name: "Split" })).toBeInTheDocument();
    await expect.poll(() => document.activeElement?.textContent).toBe("Split");
  });

  it("focuses the cancel button of a destructive confirm", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "Delete?", confirmLabel: "Delete", cancelLabel: "Keep" });
    await expect.element(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    await expect.poll(() => document.activeElement?.textContent).toBe("Keep");
  });

  it("regression: Enter confirms a primary confirm instead of pressing the header close button", async () => {
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "Split all?", variant: "primary" });
    await expect.element(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    await expect.poll(() => document.activeElement?.textContent).toBe("Confirm");
    await userEvent.keyboard("{Enter}");
    expect(await result).toBe(true);
  });

  it("Enter on a destructive confirm cancels through the cancel button", async () => {
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "Delete?" });
    await expect.element(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    await expect.poll(() => document.activeElement?.textContent).toBe("Cancel");
    await userEvent.keyboard("{Enter}");
    expect(await result).toBe(false);
  });

  // -- Don't ask again --------------------------------------------------------

  it("renders the 'Don't ask again' checkbox when settingsKey is provided", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "OK?", settingsKey: "confirmClearProject" });
    await expect.element(screen.getByText(/Don't ask again/)).toBeInTheDocument();
  });

  it("omits the checkbox when settingsKey is absent", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "OK?" });
    await expect.element(screen.getByRole("heading", { name: "OK?" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Don't ask again");
  });

  it("writes the settings key when 'Don't ask again' is checked and Confirm is clicked", async () => {
    expect(useSettingsStore.getState().confirmClearProject).toBe(true);
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "OK?", settingsKey: "confirmClearProject" });
    await expect.element(screen.getByText(/Don't ask again/)).toBeInTheDocument();
    await screen.getByLabelText(/Don't ask again/).click();
    await screen.getByRole("button", { name: "Confirm" }).click();
    expect(await result).toBe(true);
    expect(useSettingsStore.getState().confirmClearProject).toBe(false);
  });

  it("does NOT write the settings key when 'Don't ask again' is checked and Cancel is clicked", async () => {
    const screen = await render(<ConfirmModalHost />);
    const result = useConfirmStore.getState().open({ title: "OK?", settingsKey: "confirmClearProject" });
    await expect.element(screen.getByText(/Don't ask again/)).toBeInTheDocument();
    await screen.getByLabelText(/Don't ask again/).click();
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(await result).toBe(false);
    expect(useSettingsStore.getState().confirmClearProject).toBe(true);
  });

  it("renders custom confirm and cancel labels", async () => {
    const screen = await render(<ConfirmModalHost />);
    useConfirmStore.getState().open({ title: "Delete?", confirmLabel: "Yes, delete", cancelLabel: "Keep it" });
    await expect.element(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });
});
