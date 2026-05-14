import { describe, expect, it } from "vitest";
import { EditPanel } from "@/views/edit";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";

describe("EditPanel", () => {
  it("renders a textarea or contenteditable region for editing lyrics", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const editable = screen.container.querySelector("textarea, [contenteditable]");
    expect(editable).not.toBeNull();
  });
});
