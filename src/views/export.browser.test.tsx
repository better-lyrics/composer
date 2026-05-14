import { describe, expect, it } from "vitest";
import { ExportPanel } from "@/views/export";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";

describe("ExportPanel", () => {
  it("shows the 'No lyrics to export' empty state when there are no lines", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<ExportPanel />);
    await expect.element(screen.getByText("No lyrics to export")).toBeInTheDocument();
  });
});
