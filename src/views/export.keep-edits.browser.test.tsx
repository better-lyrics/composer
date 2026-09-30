import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { ExportPanel } from "@/views/export";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];

function namedLines(untimed: string[] = []): LyricLine[] {
  return NAMES.map((name, index) => {
    const id = name[0]?.toLowerCase() ?? String(index);
    const timing = untimed.includes(name) ? {} : { begin: index, end: index + 1 };
    return {
      ...createLine({ id, text: name, ...timing }),
      translations: {
        es: {
          language: "es",
          text: `${name} es`,
          origin: index % 2 === 0 ? ("manual" as const) : ("google" as const),
          sourceFingerprint: `fp-${id}`,
        },
      },
    };
  });
}

// -- Helpers ------------------------------------------------------------------

async function renderPanel() {
  return render(
    <>
      <ExportPanel />
      <Toaster />
    </>,
  );
}

type Screen = Awaited<ReturnType<typeof renderPanel>>;

function editorOf(screen: Screen) {
  return screen.getByRole("textbox", { name: "Edit TTML content" });
}

async function editText(screen: Screen, from: string, to: string) {
  const textarea = editorOf(screen);
  await textarea.fill((textarea.element() as HTMLTextAreaElement).value.replace(`>${from}<`, `>${to}<`));
}

function byId(id: string): LyricLine | undefined {
  return useProjectStore.getState().lines.find((line) => line.id === id);
}

// -- Constants ----------------------------------------------------------------

const LYRICS_CHANGED =
  "The lyrics changed since you started editing, so your edits only change the exported file. Regenerate and edit again to apply them.";

// -- Tests --------------------------------------------------------------------

describe("ExportPanel · Done after the lyrics changed under an edit", () => {
  async function doneShowsLyricsChanged(screen: Screen) {
    await screen.getByRole("button", { name: "Done" }).click();
    await expect.element(screen.getByText(LYRICS_CHANGED)).toBeInTheDocument();
  }

  describe("regressions", () => {
    it("regression: a line deleted in the project, then Keep my edits and Done, leaves the lyrics as they are", async () => {
      useProjectStore.setState({ lines: namedLines() });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Charlie", "Charlie!");
      useProjectStore.setState((state) => ({ lines: state.lines.filter((line) => line.id !== "b") }));
      const afterDelete = useProjectStore.getState().lines;
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      await editText(screen, "Echo", "Echo!");
      await doneShowsLyricsChanged(screen);

      expect(useProjectStore.getState().lines).toBe(afterDelete);
      expect(byId("b")).toBeUndefined();
      expect(useProjectStore.getState().ttmlEditState?.content).toContain("Echo!");
    });

    it("regression: syncing a middle line after an export-only Done, then Keep my edits and Done, keeps the synced line", async () => {
      useProjectStore.setState({ lines: namedLines(["Bravo"]) });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Delta", "Delta!");
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();

      const synced = namedLines();
      useProjectStore.setState({ lines: synced });
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Echo", "Echo!");
      await doneShowsLyricsChanged(screen);

      expect(useProjectStore.getState().lines).toBe(synced);
      expect(byId("b")).toMatchObject({ id: "b", text: "Bravo", begin: 1, end: 2 });
    });

    it("regression: a clean change after Keep my edits still leaves the synced line in place on Done", async () => {
      useProjectStore.setState({ lines: namedLines(["Bravo"]) });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Delta", "Delta!");
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();

      useProjectStore.setState({ lines: namedLines() });
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      useProjectStore.getState().setMetadata({ title: "Renamed" });
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Echo", "Echo!");
      await doneShowsLyricsChanged(screen);

      expect(byId("b")).toMatchObject({ id: "b", text: "Bravo", begin: 1, end: 2 });
      expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("regression: a line added to the project after the edit started survives Keep my edits and Done", async () => {
      useProjectStore.setState({ lines: namedLines() });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Charlie", "Charlie!");
      const added = createLine({ id: "n", text: "New line", begin: 1.5, end: 1.9 });
      useProjectStore.setState((state) => ({
        lines: state.lines.flatMap((line) => (line.id === "b" ? [line, added] : [line])),
      }));
      const withAdded = useProjectStore.getState().lines;
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      await doneShowsLyricsChanged(screen);

      expect(useProjectStore.getState().lines).toBe(withAdded);
      expect(byId("n")).toEqual(added);
    });

    it("regression: a translation typed into the TTML never lands on another line after a clean change", async () => {
      useProjectStore.setState({
        lines: NAMES.map((name, index) =>
          createLine({ id: name[0]?.toLowerCase(), text: name, begin: index, end: index + 1 }),
        ),
      });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      const textarea = editorOf(screen);
      const withTranslation = (textarea.element() as HTMLTextAreaElement).value.replace(
        "</metadata>",
        '<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><translations><translation xml:lang="es" type="subtitle"><text for="L3">Charlie es</text></translation></translations></iTunesMetadata></metadata>',
      );
      await textarea.fill(withTranslation);
      useProjectStore.setState((state) => ({ lines: state.lines.filter((line) => line.id !== "a") }));
      await expect.poll(() => (textarea.element() as HTMLTextAreaElement).value).not.toContain(">Alpha<");
      const afterDelete = useProjectStore.getState().lines;
      await doneShowsLyricsChanged(screen);

      expect(useProjectStore.getState().lines).toBe(afterDelete);
      expect(byId("d")?.translations).toBeUndefined();
    });
  });
});
