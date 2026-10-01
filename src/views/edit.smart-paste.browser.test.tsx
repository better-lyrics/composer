import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { backupText, projectFileText } from "@/test/project-file-fixtures";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { render } from "@/test/render";
import { ChoiceModalHost } from "@/ui/choice-modal";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { EditPanel } from "@/views/edit";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// -- Fixtures -----------------------------------------------------------------

const TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000">Hello</p><p begin="00:02.000" end="00:03.000">World</p></div></body></tt>';
const LRC = "[00:01.00]Is this the real life\n[00:03.00]Is this just fantasy";
const SRT = "1\n00:00:02,000 --> 00:00:04,500\nFirst subtitle line\n\n2\n00:00:05,000 --> 00:00:07,000\nSecond line";
const WEIRD_LRC = "[00:99.99]Invalid time\n[aa:bb.cc]garbage\nplain line no timestamp\n[00:01.00]valid\n";

// -- Helpers ------------------------------------------------------------------

async function renderEdit() {
  const screen = await render(
    <>
      <EditPanel />
      <ConfirmModalHost />
      <ChoiceModalHost />
      <Toaster />
    </>,
  );
  const textarea = screen.getByLabelText("Paste or type lyrics").element() as HTMLTextAreaElement;
  return { screen, textarea };
}

function pasteText(textarea: HTMLTextAreaElement, text: string): ClipboardEvent {
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const event = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
  textarea.focus();
  textarea.dispatchEvent(event);
  return event;
}

function lineTexts(): string[] {
  return useProjectStore.getState().lines.map((line) => line.text);
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel smart paste", () => {
  it("imports a pasted TTML document with its timing instead of showing the XML", async () => {
    const { screen, textarea } = await renderEdit();
    const event = pasteText(textarea, TTML);
    expect(event.defaultPrevented).toBe(true);
    await expect.poll(lineTexts).toEqual(["Hello", "World"]);
    expect(useProjectStore.getState().lines[0].begin).toBe(1);
    await expect.poll(() => textarea.value).toBe("Hello\nWorld");
    await expect.element(screen.getByText("Imported 2 lines from pasted text with 2 timed lines")).toBeInTheDocument();
  });

  it("imports pasted LRC, SRT and QRC", async () => {
    const { textarea } = await renderEdit();
    pasteText(textarea, LRC);
    await expect.poll(lineTexts).toEqual(["Is this the real life", "Is this just fantasy"]);
    useProjectStore.setState({ lines: [] });
    pasteText(textarea, SRT);
    await expect.poll(lineTexts).toEqual(["First subtitle line", "Second line"]);
    useProjectStore.setState({ lines: [] });
    pasteText(textarea, WANDERLUST_QRC);
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
  });

  it("asks before replacing existing lyrics, and the paste is one undo step", async () => {
    useProjectStore.setState({
      activeTab: "edit",
      lines: [createLine({ text: "Old one" }), createLine({ text: "Old two" })],
    });
    const { screen, textarea } = await renderEdit();
    pasteText(textarea, LRC);
    await screen.getByRole("button", { name: "Replace" }).click();
    await expect.poll(lineTexts).toEqual(["Is this the real life", "Is this just fantasy"]);
    textarea.focus();
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
    await expect.poll(lineTexts).toEqual(["Old one", "Old two"]);
  });

  it("keeps a typing run and a pasted file as two undo steps", async () => {
    useSettingsStore.setState({ confirmReplaceLyrics: false });
    useProjectStore.setState({ activeTab: "edit", lines: [createLine({ text: "First" })] });
    const { textarea } = await renderEdit();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "First\nTyped");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await expect.poll(lineTexts).toEqual(["First", "Typed"]);
    pasteText(textarea, LRC);
    await expect.poll(lineTexts).toEqual(["Is this the real life", "Is this just fantasy"]);
    await new Promise((resolve) => setTimeout(resolve, 700));
    useProjectStore.getState().undo();
    expect(lineTexts()).toEqual(["First", "Typed"]);
    useProjectStore.getState().undo();
    expect(lineTexts()).toEqual(["First"]);
  });

  it("keeps the lyrics and the text when the replace is cancelled", async () => {
    useProjectStore.setState({ lines: [createLine({ text: "Keep me" })] });
    const { screen, textarea } = await renderEdit();
    pasteText(textarea, TTML);
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(lineTexts()).toEqual(["Keep me"]);
    expect(textarea.value).toBe("Keep me");
  });

  it("warns about lines it could not read", async () => {
    const { screen, textarea } = await renderEdit();
    pasteText(textarea, WEIRD_LRC);
    await expect.poll(lineTexts).toEqual(["valid"]);
    await expect.element(screen.getByText("Imported 1 line. 3 lines could not be read.")).toBeInTheDocument();
  });

  describe("project files", () => {
    it("asks how to use a pasted project file and takes its lyrics", async () => {
      const { screen, textarea } = await renderEdit();
      expect(pasteText(textarea, projectFileText()).defaultPrevented).toBe(true);
      await expect
        .element(screen.getByRole("alertdialog", { name: "You pasted a Composer project" }))
        .toBeInTheDocument();
      await screen.getByRole("button", { name: "Use its lyrics here" }).click();
      await expect.poll(lineTexts).toEqual(["Climb up the H of the Hollywood sign", "In these stolen moments"]);
    });

    it("only offers a restore for a pasted backup, and Cancel changes nothing", async () => {
      const { screen, textarea } = await renderEdit();
      pasteText(textarea, backupText(["One"]));
      await expect.element(screen.getByRole("button", { name: "Restore backup" })).toBeInTheDocument();
      await screen.getByRole("button", { name: "Cancel" }).click();
      expect(lineTexts()).toEqual([]);
      expect(textarea.value).toBe("");
    });
  });

  describe("typed text keeps the normal paste", () => {
    it("lets plain lyrics paste into the text area", async () => {
      const { textarea } = await renderEdit();
      expect(pasteText(textarea, "Hello (ooh) world").defaultPrevented).toBe(false);
    });

    it("lets ambiguous text paste as typed text", async () => {
      const { textarea } = await renderEdit();
      expect(pasteText(textarea, "Type <tt> for teletype").defaultPrevented).toBe(false);
      expect(pasteText(textarea, '{"note": "not a project"}').defaultPrevented).toBe(false);
      expect(pasteText(textarea, "[Chorus]").defaultPrevented).toBe(false);
    });
  });

  describe("regressions", () => {
    it("regression: a paste event with no clipboard data still takes the typed paste path", async () => {
      useSettingsStore.setState({ autoExtractBackgroundVocals: true });
      const { screen, textarea } = await renderEdit();
      const event = new Event("paste", { bubbles: true, cancelable: true });
      textarea.focus();
      textarea.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "Hi (ooh)");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await expect.poll(() => useProjectStore.getState().lines[0]?.backgroundText).toBe("(ooh)");
      expect(screen.container.textContent).not.toContain("Imported");
    });
  });
});
