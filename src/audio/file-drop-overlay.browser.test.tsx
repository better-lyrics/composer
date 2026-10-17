import { FileDropOverlay } from "@/audio/file-drop-overlay";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

describe("FileDropOverlay", () => {
  it("shows its label while visible", async () => {
    const screen = await render(<FileDropOverlay visible label="Drop to load this audio" />);
    await expect.element(screen.getByText("Drop to load this audio", { exact: true })).toBeInTheDocument();
  });

  it("renders nothing while hidden", async () => {
    const screen = await render(<FileDropOverlay visible={false} label="Drop to load this audio" />);
    expect(screen.container.querySelector("[data-file-drop-overlay]")).toBeNull();
  });

  describe("invariants", () => {
    it("never takes the drop itself, so the area under it keeps every event", async () => {
      const screen = await render(<FileDropOverlay visible label="Drop" />);
      expect(screen.container.querySelector("[data-file-drop-overlay]")?.className).toContain("pointer-events-none");
    });

    it("stays out of the accessibility tree, it only mirrors a drag in progress", async () => {
      const screen = await render(<FileDropOverlay visible label="Drop" />);
      expect(screen.container.querySelector("[data-file-drop-overlay]")?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
