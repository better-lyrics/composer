import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TtmlConflictNotice } from "@/views/export/ttml-conflict-notice";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("TtmlConflictNotice", () => {
  it("renders an alert with the conflict message", async () => {
    const screen = await render(<TtmlConflictNotice onRegenerate={() => {}} onKeepEdits={() => {}} />);
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    await expect.element(screen.getByText("The lyrics changed", { exact: false })).toBeInTheDocument();
  });

  it("says which version the export currently uses", async () => {
    const screen = await render(<TtmlConflictNotice onRegenerate={() => {}} onKeepEdits={() => {}} />);
    await expect.element(screen.getByText("uses your edits", { exact: false })).toBeInTheDocument();
  });

  it("regenerates on click", async () => {
    const onRegenerate = vi.fn();
    const screen = await render(<TtmlConflictNotice onRegenerate={onRegenerate} onKeepEdits={() => {}} />);
    await screen.getByRole("button", { name: "Regenerate" }).click();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("keeps the edits on click", async () => {
    const onKeepEdits = vi.fn();
    const screen = await render(<TtmlConflictNotice onRegenerate={() => {}} onKeepEdits={onKeepEdits} />);
    await screen.getByRole("button", { name: "Keep my edits" }).click();
    expect(onKeepEdits).toHaveBeenCalledOnce();
  });

  it("resolves from the keyboard", async () => {
    const onKeepEdits = vi.fn();
    await render(<TtmlConflictNotice onRegenerate={() => {}} onKeepEdits={onKeepEdits} />);

    await userEvent.tab();
    await expect.poll(() => document.activeElement?.textContent).toContain("Keep my edits");
    await userEvent.keyboard("{Enter}");

    expect(onKeepEdits).toHaveBeenCalledOnce();
  });
});
