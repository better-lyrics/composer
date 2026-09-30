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

// -- Tests --------------------------------------------------------------------

describe("ExportPanel · Done after keeping edits through a conflict", () => {
  describe("regressions", () => {
    it("regression: a line deleted in the project, then Keep my edits and Done, keeps every untouched line", async () => {
      const stored = namedLines();
      useProjectStore.setState({ lines: stored });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Charlie", "Charlie!");
      useProjectStore.setState((state) => ({ lines: state.lines.filter((line) => line.id !== "b") }));
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      await editText(screen, "Echo", "Echo!");
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();

      expect(byId("a")).toEqual(stored[0]);
      expect(byId("d")).toEqual(stored[3]);
      expect(byId("c")).toMatchObject({ text: "Charlie!", translations: stored[2]?.translations });
      expect(byId("e")).toMatchObject({ text: "Echo!", translations: stored[4]?.translations });
    });

    it("regression: a later project change after Keep my edits merges cleanly and Done keeps every untouched line", async () => {
      const stored = namedLines();
      useProjectStore.setState({ lines: stored });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await editText(screen, "Charlie", "Charlie!");
      useProjectStore.setState((state) => ({ lines: state.lines.filter((line) => line.id !== "b") }));
      await screen.getByRole("button", { name: "Keep my edits" }).click();
      await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
      useProjectStore.setState((state) => ({
        lines: state.lines.map((line) => (line.id === "e" ? { ...line, text: "Echo changed" } : line)),
      }));
      await expect.poll(() => (editorOf(screen).element() as HTMLTextAreaElement).value).toContain("Echo changed");
      expect(screen.container.querySelector("[role=alert]")).toBeNull();
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();

      expect(byId("a")).toEqual(stored[0]);
      expect(byId("d")).toEqual(stored[3]);
      expect(byId("c")).toMatchObject({ text: "Charlie!", translations: stored[2]?.translations });
      expect(byId("e")).toMatchObject({ text: "Echo changed", translations: stored[4]?.translations });
    });

    it("regression: syncing a middle line after an export-only Done, then Keep my edits and Done, keeps every line the kept edit holds", async () => {
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
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();

      expect(useProjectStore.getState().lines.map((line) => line.id)).toEqual(["a", "c", "d", "e"]);
      expect(byId("a")).toEqual(synced[0]);
      expect(byId("c")).toEqual(synced[2]);
      expect(byId("d")).toMatchObject({ text: "Delta!", translations: synced[3]?.translations });
      expect(byId("e")).toMatchObject({ text: "Echo!", translations: synced[4]?.translations });
    });
  });
});
