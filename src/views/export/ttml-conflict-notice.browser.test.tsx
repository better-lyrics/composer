import { describe, expect, it, vi } from "vitest";
import { TtmlConflictNotice } from "@/views/export/ttml-conflict-notice";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("TtmlConflictNotice", () => {
  it("renders an alert with the conflict message", async () => {
    const screen = await render(<TtmlConflictNotice onRegenerate={() => {}} />);
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    await expect.element(screen.getByText("The lyrics changed", { exact: false })).toBeInTheDocument();
  });

  it("regenerates on click", async () => {
    const onRegenerate = vi.fn();
    const screen = await render(<TtmlConflictNotice onRegenerate={onRegenerate} />);
    await screen.getByRole("button", { name: "Regenerate" }).click();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
