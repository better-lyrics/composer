import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { TabBar } from "@/ui/tab-bar";
import { isMac } from "@/utils/platform";
import { EditorScreen } from "@/views/editor-screen";

// -- Helpers ------------------------------------------------------------------

function pressUndo(target: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "z",
    code: "KeyZ",
    metaKey: isMac,
    ctrlKey: !isMac,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

const firstLineText = () => useProjectStore.getState().lines[0].text;

// -- Tests --------------------------------------------------------------------

describe("EditorScreen", () => {
  it("shows only the active tab's panel", async () => {
    useProjectStore.setState({ activeTab: "export", lines: [createLine({ text: "a", begin: 0, end: 1 })] });
    const screen = await render(<EditorScreen />, { withRouter: true });
    const exportPanel = screen.container.querySelector('[data-tour="export-panel"]') as HTMLElement | null;
    const importPanel = screen.container.querySelector('[data-tour="import-dropzone"]') as HTMLElement | null;
    expect(exportPanel?.checkVisibility()).toBe(true);
    expect(importPanel?.checkVisibility() ?? false).toBe(false);
  });

  it("switches panels when the tab bar is used from the keyboard", async () => {
    useProjectStore.setState({ activeTab: "import" });
    const screen = await render(
      <>
        <TabBar />
        <EditorScreen />
      </>,
      { withRouter: true },
    );
    const editTab = screen.container.querySelector('[data-tour="tab-edit"]') as HTMLButtonElement;
    editTab.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().activeTab).toBe("edit");
    const importPanel = screen.container.querySelector('[data-tour="import-dropzone"]') as HTMLElement | null;
    expect(importPanel?.checkVisibility() ?? false).toBe(false);
  });

  it("regression: undo works on the Export tab and stays native in the TTML editor", async () => {
    useProjectStore.setState({
      activeTab: "export",
      lines: [createLine({ id: "line", text: "Before", begin: 0, end: 1 })],
    });
    useProjectStore.getState().updateLineWithHistory("line", { text: "After" });
    const screen = await render(<EditorScreen />, { withRouter: true });

    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" }).element();
    expect(pressUndo(textarea).defaultPrevented).toBe(false);
    expect(firstLineText()).toBe("After");

    pressUndo(document.body);
    await expect.poll(firstLineText).toBe("Before");
  });
});
