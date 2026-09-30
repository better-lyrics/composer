import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { ExportPanel } from "@/views/export";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function renderConflicted() {
  useProjectStore.setState({
    lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
  });
  const screen = await render(
    <>
      <ExportPanel />
      <Toaster />
    </>,
  );
  await screen.getByRole("button", { name: /Edit$/ }).click();
  const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
  const generated = (textarea.element() as HTMLTextAreaElement).value;
  await textarea.fill(generated.replace("Hello", "HELLO EDITED"));
  useProjectStore.setState((state) => ({
    lines: state.lines.map((line, index) => (index === 0 ? { ...line, text: "HELLO REGEN" } : line)),
  }));
  await expect.element(screen.getByRole("alert")).toBeInTheDocument();
  return { screen, textarea };
}

// -- Tests --------------------------------------------------------------------

describe("ExportPanel · edits across regeneration", () => {
  it("regression: preserves a disjoint edit when the underlying TTML regenerates", async () => {
    useProjectStore.setState({
      lines: [
        createLine({ text: "Hello", begin: 0, end: 1 }),
        createLine({ text: "World", begin: 1, end: 2 }),
        createLine({ text: "Third", begin: 2, end: 3 }),
      ],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));

    useProjectStore.setState((state) => ({
      lines: state.lines.map((line, index) => (index === 2 ? { ...line, text: "THIRD CHANGED" } : line)),
    }));

    await expect.poll(() => (textarea.element() as HTMLTextAreaElement).value).toContain("HELLO EDITED");
    expect((textarea.element() as HTMLTextAreaElement).value).toContain("THIRD CHANGED");
  });

  it("flags a conflict when the edited region itself regenerates, keeping the user's text", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));

    useProjectStore.setState((state) => ({
      lines: state.lines.map((line, index) => (index === 0 ? { ...line, text: "HELLO REGEN" } : line)),
    }));

    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    await expect.element(screen.getByText("The lyrics changed", { exact: false })).toBeInTheDocument();
    expect((textarea.element() as HTMLTextAreaElement).value).toContain("HELLO EDITED");
  });

  it("regression: typing in the editor does not silently resolve a conflict", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));

    useProjectStore.setState((state) => ({
      lines: state.lines.map((line, index) => (index === 0 ? { ...line, text: "HELLO REGEN" } : line)),
    }));
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();

    await textarea.fill(`${(textarea.element() as HTMLTextAreaElement).value} `);

    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("clears the conflict only when the user keeps their edits explicitly", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));

    useProjectStore.setState((state) => ({
      lines: state.lines.map((line, index) => (index === 0 ? { ...line, text: "HELLO REGEN" } : line)),
    }));
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();

    await screen.getByRole("button", { name: "Keep my edits" }).click();

    await expect.poll(() => screen.container.querySelector("[role=alert]")).toBeNull();
    expect((textarea.element() as HTMLTextAreaElement).value).toContain("HELLO EDITED");
  });

  it("surfaces the conflict notice in preview mode after Done, not only while editing", async () => {
    const { screen } = await renderConflicted();
    await screen.getByRole("button", { name: "Done" }).click();
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.container.querySelector("textarea")).toBeNull();
  });

  describe("regressions", () => {
    it("regression: Done with a conflicting edit leaves the lyrics alone and keeps the edit for export", async () => {
      const { screen } = await renderConflicted();
      const conflictedLines = useProjectStore.getState().lines;
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();
      expect(useProjectStore.getState().lines).toBe(conflictedLines);
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["HELLO REGEN", "World"]);
      expect(useProjectStore.getState().ttmlEditState?.content).toContain("HELLO EDITED");
      expect(screen.getByText("Updated the lyrics from the TTML").elements()).toHaveLength(0);
    });
  });
});
