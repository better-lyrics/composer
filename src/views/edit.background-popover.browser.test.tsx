import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Helpers ------------------------------------------------------------------

async function openBackgroundPopover() {
  const screen = await render(<EditPanel />);
  await screen.getByRole("button", { name: "BG", exact: true }).click();
  const input = screen.getByRole("textbox", { name: "Background vocals text" });
  await expect.element(input).toBeInTheDocument();
  return input;
}

function extractedLine() {
  return createLine({ id: "l1", text: "Hello world", backgroundText: "ooh", backgroundTextSource: "extraction" });
}

// -- Tests --------------------------------------------------------------------

describe("background vocals popover", () => {
  it("writes edited text on Enter as one undo step", async () => {
    useProjectStore
      .getState()
      .setLinesWithHistory([createLine({ id: "l1", text: "Hello world", backgroundText: "yea" })]);
    const input = await openBackgroundPopover();

    await input.fill("yeah");
    await userEvent.keyboard("{Enter}");
    await expect.element(input).not.toBeInTheDocument();
    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("yeah");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].backgroundText).toBe("yea");
  });
});

describe("regressions", () => {
  it("regression #277: shows background text changed outside Edit when the popover opens", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world", backgroundText: "yea" })] });
    const screen = await render(<EditPanel />);

    useProjectStore.getState().updateLineWithHistory("l1", { backgroundText: "yeah" });
    await screen.getByRole("button", { name: "BG", exact: true }).click();

    await expect.element(screen.getByRole("textbox", { name: "Background vocals text" })).toHaveValue("yeah");
  });

  it("regression #277: closing the popover keeps background text changed outside Edit", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "l1", text: "Hello world", backgroundText: "yea" })] });
    const screen = await render(<EditPanel />);

    useProjectStore.getState().updateLineWithHistory("l1", { backgroundText: "yeah" });
    await screen.getByRole("button", { name: "BG", exact: true }).click();
    await screen.getByRole("textbox", { name: "Background vocals text" }).click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => useProjectStore.getState().lines[0].backgroundText).toBe("yeah");
  });

  it("regression: blurring without an edit leaves the line and history untouched", async () => {
    useProjectStore.getState().setLinesWithHistory([extractedLine()]);
    const linesBefore = useProjectStore.getState().lines;
    const input = await openBackgroundPopover();

    (input.element() as HTMLInputElement).blur();

    expect(useProjectStore.getState().lines).toBe(linesBefore);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).not.toBe(linesBefore);
  });

  it("regression: pressing Enter without an edit keeps an extracted background", async () => {
    useProjectStore.getState().setLinesWithHistory([extractedLine()]);
    const linesBefore = useProjectStore.getState().lines;
    const input = await openBackgroundPopover();

    await input.click();
    await userEvent.keyboard("{Enter}");
    await expect.element(input).not.toBeInTheDocument();

    expect(useProjectStore.getState().lines).toBe(linesBefore);
    expect(useProjectStore.getState().lines[0].backgroundTextSource).toBe("extraction");
  });
});
