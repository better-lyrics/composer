import { useProjectStore } from "@/stores/project";
import { stubClipboard } from "@/test/clipboard";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { ExportPanel } from "@/views/export";
import { beforeEach, describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function wordSyncedLines() {
  return [
    createLine({
      id: "L1",
      text: "Comin' at you, baby",
      words: [
        createWord({ text: "Comin' ", begin: 1.437, end: 2.067 }),
        createWord({ text: "at ", begin: 2.067, end: 2.382 }),
        createWord({ text: "you, ", begin: 2.382, end: 2.649 }),
        createWord({ text: "baby", begin: 2.649, end: 3.012 }),
      ],
    }),
  ];
}

function shownTtml(container: HTMLElement): string {
  return container.querySelector("pre")?.textContent ?? "";
}

async function renderPanel() {
  const screen = await render(<ExportPanel />);
  await expect.poll(() => shownTtml(screen.container)).toContain("<tt");
  return screen;
}

// -- Tests --------------------------------------------------------------------

describe("ExportPanel · line timing", () => {
  beforeEach(() => {
    useProjectStore.setState({ lines: wordSyncedLines() });
  });

  describe("happy paths", () => {
    it("shows word spans by default", async () => {
      const screen = await renderPanel();
      expect(screen.getByRole("button", { name: "Word" }).element().getAttribute("aria-pressed")).toBe("true");
      expect(shownTtml(screen.container)).toContain('itunes:timing="Word"');
    });

    it("shows a line-synced TTML after picking Line, and keeps the word timing in the project", async () => {
      const screen = await renderPanel();
      await screen.getByRole("button", { name: "Line" }).click();

      await expect.poll(() => shownTtml(screen.container)).toContain('itunes:timing="Line"');
      expect(shownTtml(screen.container)).toMatch(/end="0:03.012" itunes:key="L1"[^>]*>Comin' at you, baby<\/p>/);
      expect(useProjectStore.getState().exportTiming).toBe("line");
      expect(useProjectStore.getState().lines[0].words).toHaveLength(4);
    });

    it("copies the line-synced TTML", async () => {
      const screen = await renderPanel();
      await screen.getByRole("button", { name: "Line" }).click();
      const clipboard = stubClipboard();
      try {
        await screen.getByRole("button", { name: "Copy" }).click();
        await expect.poll(() => clipboard.writes.length).toBe(1);
        expect(clipboard.writes[0]).toContain('itunes:timing="Line"');
        expect(clipboard.writes[0]).not.toContain('<span begin="0:01.437"');
      } finally {
        clipboard.restore();
      }
    });

    it("shows word spans again after picking Word", async () => {
      useProjectStore.setState({ exportTiming: "line" });
      const screen = await renderPanel();
      await screen.getByRole("button", { name: "Word" }).click();

      await expect.poll(() => shownTtml(screen.container)).toContain('itunes:timing="Word"');
      expect(useProjectStore.getState().exportTiming).toBe("word");
    });
  });

  describe("cross-field interactions", () => {
    it("locks Edit while Line is picked, so Done can never strip the word timing", async () => {
      useProjectStore.setState({ exportTiming: "line" });
      const screen = await renderPanel();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeDisabled();
    });

    it("locks Line while editing", async () => {
      const screen = await renderPanel();
      await screen.getByRole("button", { name: /Edit$/ }).click();
      await expect.element(screen.getByRole("button", { name: "Line" })).toBeDisabled();
    });

    it("exports the edited TTML and locks Line while an edit exists", async () => {
      const screen = await renderPanel();
      const generated = shownTtml(screen.container);
      useProjectStore.setState({
        exportTiming: "line",
        ttmlEditState: { source: generated, content: generated.replace("baby", "lady") },
      });

      await expect.element(screen.getByRole("button", { name: "Line" })).toBeDisabled();
      expect(shownTtml(screen.container)).toContain(">lady</span>");
      expect(screen.getByRole("button", { name: "Word" }).element().getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("edge cases", () => {
    it("shows the saved Line choice when the panel opens", async () => {
      useProjectStore.setState({ exportTiming: "line" });
      const screen = await renderPanel();
      expect(shownTtml(screen.container)).toContain('itunes:timing="Line"');
      expect(screen.getByRole("button", { name: "Line" }).element().getAttribute("aria-pressed")).toBe("true");
    });
  });
});
