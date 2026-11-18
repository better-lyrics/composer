import { beforeEach, describe, expect, it } from "vitest";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, timedSyllables } from "insync/line-track";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";
import { getSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

// Writes the text the way a keystroke leaves it: the new value with the caret after the typed text.
function typeInto(textarea: HTMLTextAreaElement, value: string, caret: number): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

const storedLine = () => useProjectStore.getState().lines[0];

// -- Tests --------------------------------------------------------------------

describe("Edit shows background vocals inline", () => {
  beforeEach(() => {
    useProjectStore.setState({ activeTab: "edit" });
  });

  it("shows a timed background in brackets and edits it in place, keeping the timing of unchanged syllables", async () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l1",
          text: "Hold me close",
          words: [
            { text: "Hold", sep: " ", begin: 10, end: 11 },
            { text: "me", sep: " ", begin: 11, end: 12 },
            { text: "close", begin: 12, end: 13 },
          ],
          backgroundText: "ooh yeah",
          backgroundWords: [
            { text: "ooh", sep: " ", begin: 13.2, end: 13.6 },
            { text: "yeah", begin: 13.6, end: 14 },
          ],
          backgroundTextSource: "extraction",
        }),
      ],
    });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hold me close (ooh yeah)");
    const [ooh] = timedSyllables(backgroundTrack(storedLine()));

    const edited = "Hold me close (ooh yes)";
    typeInto(textarea, edited, edited.indexOf("yes") + 3);

    await expect.poll(() => backgroundText(storedLine(), getSplitCharacter())).toBe("ooh yes");
    expect(lineText(storedLine(), getSplitCharacter())).toBe("Hold me close");
    expect(timedSyllables(backgroundTrack(storedLine()))[0]).toEqual(ooh);
    expect(textarea.value).toBe(edited);
  });

  it("keeps typed parentheses in the main text when auto-extract is off", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "Hold (me) close", backgroundText: "ooh", backgroundTextSource: "manual" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hold (me) close (ooh)");

    typeInto(textarea, "Oh Hold (me) close (ooh)", 3);
    textarea.focus();
    textarea.blur();

    await expect.poll(() => lineText(storedLine(), getSplitCharacter())).toBe("Oh Hold (me) close");
    expect(backgroundText(storedLine(), getSplitCharacter())).toBe("ooh");
  });

  it("leaves pairs pasted inside a background as pasted on paste and blur when auto-extract is off", async () => {
    useSettingsStore.setState({ autoExtractBackgroundVocals: false });
    useProjectStore.setState({
      lines: [createLine({ id: "l1", text: "amber sway sway", backgroundText: "(amber sway hush)" })],
    });
    const screen = await render(<EditPanel />);
    const textarea = screen.container.querySelector("textarea") as HTMLTextAreaElement;
    const at = textarea.value.indexOf("(amber") + "(amber".length;
    const pasted = " echo (cinder tide)";

    textarea.focus();
    textarea.setSelectionRange(at, at);
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", pasted);
    textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    textarea.setRangeText(pasted, at, at, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const nested = "(amber echo (cinder tide) sway hush)";
    await expect.poll(() => backgroundText(storedLine(), getSplitCharacter())).toBe(nested);
    textarea.blur();
    await expect.poll(() => textarea.value).toBe(`amber sway sway ${nested}`);
    expect(backgroundText(storedLine(), getSplitCharacter())).toBe(nested);
  });
});
