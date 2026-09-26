import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { BackgroundTextEditor } from "@/views/timeline/background-text-editor";

// -- Helpers ------------------------------------------------------------------

function seedLine(overrides: Parameters<typeof createLine>[0] = {}) {
  const line = createLine({
    id: "l1",
    text: "hello",
    words: [createWord({ text: "hello", begin: 0, end: 1 })],
    ...overrides,
  });
  useProjectStore.setState({ lines: [line] });
  return line;
}

function storedLine() {
  return useProjectStore.getState().lines[0];
}

// -- Tests --------------------------------------------------------------------

describe("BackgroundTextEditor", () => {
  it("labels the background vocals input", async () => {
    const line = seedLine();
    const screen = await render(<BackgroundTextEditor lineId={line.id} />);

    await screen.getByRole("button", { name: "Add BG" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Background vocals text" })).toBeInTheDocument();
  });

  it("stamps a manual provenance when adding background text", async () => {
    const line = seedLine();
    const screen = await render(<BackgroundTextEditor lineId={line.id} />);

    await screen.getByRole("button", { name: "Add BG" }).click();
    await screen.getByPlaceholder("Background vocals").fill("ooh");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => storedLine().backgroundText).toBe("ooh");
    expect(storedLine().backgroundTextSource).toBe("manual");
  });

  it("flips an extraction-sourced background to manual when edited", async () => {
    const line = seedLine({ backgroundText: "ooh", backgroundTextSource: "extraction" });
    const screen = await render(<BackgroundTextEditor lineId={line.id} backgroundText={line.backgroundText} />);

    await screen.getByRole("button", { name: "BG: ooh" }).click();
    await screen.getByPlaceholder("Background vocals").fill("aah");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => storedLine().backgroundText).toBe("aah");
    expect(storedLine().backgroundTextSource).toBe("manual");
  });

  it("clears all three background fields when the editor is emptied", async () => {
    const line = seedLine({
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 0, end: 1 }],
      backgroundTextSource: "extraction",
    });
    const screen = await render(<BackgroundTextEditor lineId={line.id} backgroundText={line.backgroundText} />);

    await screen.getByRole("button", { name: "BG: ooh" }).click();
    await screen.getByPlaceholder("Background vocals").fill("");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => storedLine().backgroundText).toBeUndefined();
    expect(storedLine().backgroundWords).toBeUndefined();
    expect(storedLine().backgroundTextSource).toBeUndefined();
  });

  it("abandons the edit and keeps the stored text when Escape is pressed", async () => {
    const line = seedLine({ backgroundText: "ooh", backgroundTextSource: "extraction" });
    const screen = await render(<BackgroundTextEditor lineId={line.id} backgroundText={line.backgroundText} />);

    await screen.getByRole("button", { name: "BG: ooh" }).click();
    await screen.getByPlaceholder("Background vocals").fill("aah");
    await userEvent.keyboard("{Escape}");

    await expect.element(screen.getByRole("button", { name: "BG: ooh" })).toBeInTheDocument();
    expect(storedLine().backgroundText).toBe("ooh");
    expect(storedLine().backgroundTextSource).toBe("extraction");
  });

  describe("edge cases", () => {
    it("treats whitespace-only input as a clear", async () => {
      const line = seedLine({ backgroundText: "ooh", backgroundTextSource: "extraction" });
      const screen = await render(<BackgroundTextEditor lineId={line.id} backgroundText={line.backgroundText} />);

      await screen.getByRole("button", { name: "BG: ooh" }).click();
      await screen.getByPlaceholder("Background vocals").fill("   ");
      await userEvent.keyboard("{Enter}");

      await expect.poll(() => storedLine().backgroundText).toBeUndefined();
      expect(storedLine().backgroundTextSource).toBeUndefined();
    });

    it("does not let a keystroke reach a parent keyboard handler", async () => {
      const line = seedLine();
      const keysSeenByParent: string[] = [];
      const screen = await render(
        <div onKeyDown={(e) => keysSeenByParent.push(e.key)}>
          <BackgroundTextEditor lineId={line.id} />
        </div>,
      );

      await screen.getByRole("button", { name: "Add BG" }).click();
      await screen.getByPlaceholder("Background vocals").fill("o");

      expect(keysSeenByParent).toEqual([]);
    });
  });
});
