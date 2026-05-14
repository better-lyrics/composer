import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { LyricsImportModal } from "@/views/timeline/lyrics-import-modal";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";

describe("LyricsImportModal", () => {
  it("renders nothing when closed", async () => {
    await render(<LyricsImportModal isOpen={false} onClose={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("opens with the textarea focused and Import disabled until text is entered", async () => {
    const screen = await render(<LyricsImportModal isOpen onClose={() => {}} />);
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
    const importButton = screen.getByRole("button", { name: /Import$/ });
    expect((importButton.element() as HTMLButtonElement).disabled).toBe(true);
  });

  it("displays the live line count as content is entered", async () => {
    await render(<LyricsImportModal isOpen onClose={() => {}} />);
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    await userEvent.fill(textarea, "line one\nline two\nline three");
    expect(document.body.textContent).toContain("3 lines");
  });

  it("imports lines into the project store and closes when Import is clicked", async () => {
    let closed = false;
    useSettingsStore.setState({ confirmReplaceLyrics: false });
    const screen = await render(<LyricsImportModal isOpen onClose={() => (closed = true)} />);
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    textarea.focus();
    await userEvent.fill(textarea, "First lyric\nSecond lyric");
    await screen.getByRole("button", { name: /Import$/ }).click();
    expect(useProjectStore.getState().lines.length).toBe(2);
    expect(closed).toBe(true);
  });

  it("invokes onClose when Cancel is clicked", async () => {
    let closed = false;
    const screen = await render(<LyricsImportModal isOpen onClose={() => (closed = true)} />);
    await screen.getByRole("button", { name: "Cancel" }).click();
    expect(closed).toBe(true);
  });
});
