import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { generateProjectTtml } from "@/utils/ttml";
import { ExportPanel } from "@/views/export";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const NOT_SYNCED = "Your edits only change the exported file. Sync every line to let Done apply them to the lyrics.";
const KEPT_IN_EXPORT = "Updated the lyrics from the TTML. Some edits only change the exported file.";
const EXPORT_ONLY = "The lyrics stay as they were, so your edits only change the exported file.";
const APPLIED = "Updated the lyrics from the TTML";

// -- Helpers ------------------------------------------------------------------

async function renderPanel() {
  const screen = await render(
    <>
      <ExportPanel />
      <Toaster />
    </>,
  );
  return screen;
}

async function startEditing(screen: Awaited<ReturnType<typeof renderPanel>>) {
  await screen.getByRole("button", { name: /Edit$/ }).click();
  const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
  return { textarea, generated: (textarea.element() as HTMLTextAreaElement).value };
}

const lineTexts = () => useProjectStore.getState().lines.map((line) => line.text);

// -- Tests --------------------------------------------------------------------

describe("ExportPanel · Done applies edits only when the TTML holds the whole project", () => {
  describe("regressions", () => {
    it("regression: a partly synced project keeps every line and the edit stays in the export", async () => {
      useProjectStore.setState({
        lines: [
          createLine({ text: "Timed line", begin: 0, end: 1 }),
          createLine({ text: "Not yet synced" }),
          createLine({
            text: "Half synced words here",
            words: [
              { text: "Half ", begin: 1, end: 2 },
              { text: "synced ", begin: 2, end: 3 },
            ],
          }),
        ],
      });
      const before = useProjectStore.getState().lines;
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      const edited = generated.replace(">Timed line<", ">Timed line edited<");
      await textarea.fill(edited);
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(NOT_SYNCED)).toBeInTheDocument();
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().ttmlEditState?.content).toBe(edited);
      expect(useProjectStore.getState().canUndo()).toBe(false);
      expect(screen.container.querySelector("pre")?.textContent).toContain("Timed line edited");
    });

    it("regression: a fully synced project takes the edit as one undo step and keeps its song detail flags", async () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
        metadata: { title: "Typed", artists: ["Imported"], album: "", duration: 0 },
        importedMetadataKeys: ["artists"],
        hasUnexportedImport: false,
      });
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      await textarea.fill(generated.replace(">Hello<", ">Hello there<"));
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText("Updated the lyrics from the TTML", { exact: true })).toBeInTheDocument();
      expect(lineTexts()).toEqual(["Hello there", "World"]);
      expect(useProjectStore.getState().importedMetadataKeys).toEqual(["artists"]);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(false);
      expect(useProjectStore.getState().ttmlEditState).toBeNull();
      useProjectStore.getState().undo();
      expect(lineTexts()).toEqual(["Hello", "World"]);
    });

    it("regression: an edit the project cannot hold stays in the export", async () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Hello", begin: 0, end: 1 })],
        metadata: { title: "Kept title", artists: [], album: "", duration: 0 },
      });
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      const edited = generated.replace(/<ttm:title>[^<]*<\/ttm:title>/, "");
      await textarea.fill(edited);
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(KEPT_IN_EXPORT)).toBeInTheDocument();
      expect(useProjectStore.getState().metadata.title).toBe("Kept title");
      expect(useProjectStore.getState().ttmlEditState).toEqual({
        source: generateProjectTtml(useProjectStore.getState(), 0),
        content: edited,
      });
      expect(screen.container.querySelector("pre")?.textContent).not.toContain("Kept title");
    });
  });

  describe("regressions: content the export does not show", () => {
    it("regression: an unedited line keeps its split characters", async () => {
      const split = createLine({ text: "Hel|lo world", begin: 0, end: 1 });
      useProjectStore.setState({ lines: [split, createLine({ text: "Other", begin: 1, end: 2 })] });
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      await textarea.fill(generated.replace(">Other<", ">Other2<"));
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(APPLIED, { exact: true })).toBeInTheDocument();
      expect(useProjectStore.getState().lines[0]).toEqual(split);
      expect(lineTexts()).toEqual(["Hel|lo world", "Other2"]);
    });

    it("regression: blank and split-character-only lines stay in place", async () => {
      useProjectStore.setState({
        lines: [
          createLine({ id: "one", text: "One", begin: 0, end: 1 }),
          createLine({ id: "blank", text: "" }),
          createLine({ id: "split", text: "|" }),
          createLine({ id: "two", text: "Two", begin: 1, end: 2 }),
        ],
      });
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      await textarea.fill(generated.replace(">Two<", ">Two2<"));
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(APPLIED, { exact: true })).toBeInTheDocument();
      expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["one", "blank", "split", "two"]);
      expect(lineTexts()).toEqual(["One", "", "|", "Two2"]);
    });

    it("regression: a project with a field the export does not carry keeps the edit in the export only", async () => {
      useProjectStore.setState({
        lines: [
          { ...createLine({ text: "Hello", begin: 0, end: 1 }), detached: true },
          createLine({ text: "World", begin: 1, end: 2 }),
        ],
      });
      const before = useProjectStore.getState().lines;
      const screen = await renderPanel();
      const { textarea, generated } = await startEditing(screen);
      const edited = generated.replace(">World<", ">World2<");
      await textarea.fill(edited);
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(EXPORT_ONLY)).toBeInTheDocument();
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().ttmlEditState?.content).toBe(edited);
    });

    it("regression: a partly synced project with an unreadable edit also shows the XML error", async () => {
      useProjectStore.setState({
        lines: [createLine({ text: "Timed line", begin: 0, end: 1 }), createLine({ text: "Not yet synced" })],
      });
      const screen = await renderPanel();
      const { textarea } = await startEditing(screen);
      await textarea.fill("not xml at all");
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(NOT_SYNCED)).toBeInTheDocument();
      await expect.element(screen.getByText(/edited TTML/)).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("does not apply a saved edit when nothing changed in this editing session", async () => {
      useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 0, end: 1 })] });
      const generated = generateProjectTtml(useProjectStore.getState(), 0);
      const saved = generated.replace(">Hello<", ">Hello from before<");
      useProjectStore.setState({ ttmlEditState: { source: generated, content: saved } });
      const before = useProjectStore.getState().lines;
      const screen = await renderPanel();
      await startEditing(screen);
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();
      expect(useProjectStore.getState().lines).toBe(before);
      expect(useProjectStore.getState().ttmlEditState?.content).toBe(saved);
      expect(screen.getByText("Updated the lyrics from the TTML").elements()).toHaveLength(0);
    });
  });
});
