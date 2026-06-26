import { describe, expect, it } from "vitest";
import { TtmlDiffViewer } from "@/views/export/ttml-diff-viewer";
import { render } from "@/test/render";

// -- Tests --------------------------------------------------------------------

describe("TtmlDiffViewer", () => {
  it("shows both the removed original line and the added edited line", async () => {
    const oldTtml = ["alpha", "removedword", "omega"].join("\n");
    const newTtml = ["alpha", "insertedword", "omega"].join("\n");
    const screen = await render(<TtmlDiffViewer oldTtml={oldTtml} newTtml={newTtml} />);
    await expect.element(screen.getByText("insertedword")).toBeInTheDocument();
    await expect.element(screen.getByText("removedword")).toBeInTheDocument();
  });

  it("keeps unchanged lines as context", async () => {
    const oldTtml = ["keepmeline", "removedword"].join("\n");
    const newTtml = ["keepmeline", "insertedword"].join("\n");
    const screen = await render(<TtmlDiffViewer oldTtml={oldTtml} newTtml={newTtml} />);
    await expect.element(screen.getByText("keepmeline")).toBeInTheDocument();
  });

  it("prefixes added lines with + and removed lines with -", async () => {
    const oldTtml = "removed line";
    const newTtml = "added line";
    const screen = await render(<TtmlDiffViewer oldTtml={oldTtml} newTtml={newTtml} />);
    await expect.element(screen.getByText("+")).toBeInTheDocument();
    await expect.element(screen.getByText("-")).toBeInTheDocument();
  });
});
