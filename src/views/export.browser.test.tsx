import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { ExportPanel } from "@/views/export";
import { useProjectStore } from "@/stores/project";
import { stubClipboard } from "@/test/clipboard";
import { createLine, createWord, snapPoints } from "@/test/factories";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function getProjectImportInput(): HTMLInputElement {
  const input = document.querySelector(
    "input[type='file'][aria-label='Import project file']",
  ) as HTMLInputElement | null;
  if (!input) throw new Error("project import input not found");
  return input;
}

function dispatchFileChange(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", {
    value: [file] as unknown as FileList,
    configurable: true,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ExportPanel", () => {
  it("shows the 'No lyrics to export' empty state when there are no lines", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<ExportPanel />);
    await expect.element(screen.getByText("No lyrics to export")).toBeInTheDocument();
  });

  it("labels the hidden project import input on the empty state", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<ExportPanel />);
    await expect.element(screen.getByLabelText("Import project file")).toBeInTheDocument();
  });

  it("labels the project import input and TTML editor on the main view", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
    });
    const screen = await render(<ExportPanel />);
    await expect.element(screen.getByLabelText("Import project file")).toBeInTheDocument();
    await screen.getByRole("button", { name: /Edit$/ }).click();
    await expect.element(screen.getByRole("textbox", { name: "Edit TTML content" })).toBeInTheDocument();
  });

  it("renders the edit textarea outside the overflow-auto scroll container so it can fill the panel height", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    await expect.element(textarea).toBeInTheDocument();
    expect((textarea.element() as HTMLTextAreaElement).closest(".overflow-auto")).toBeNull();
  });

  it("keeps textarea edits after clicking Done", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    await screen.getByRole("textbox", { name: "Edit TTML content" }).fill("CUSTOM EDITED CONTENT");
    await screen.getByRole("button", { name: "Done" }).click();
    await expect
      .poll(() => screen.container.querySelector("pre")?.textContent ?? "")
      .toContain("CUSTOM EDITED CONTENT");
  });
});

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

  it("surfaces the conflict notice in preview mode, not only while editing", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
    });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));
    await screen.getByRole("button", { name: "Done" }).click();

    useProjectStore.setState((state) => ({
      lines: state.lines.map((line, index) => (index === 0 ? { ...line, text: "HELLO REGEN" } : line)),
    }));

    await expect.element(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.container.querySelector("textarea")).toBeNull();
  });
});

describe("ExportPanel · project file customSnapPoints", () => {
  it("writes customSnapPoints into the exported project JSON", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
      customSnapPoints: snapPoints([3, 9]),
    });
    const screen = await render(<ExportPanel />);

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob;
      return "blob:stub";
    };
    URL.revokeObjectURL = () => {};
    try {
      await screen.getByRole("button", { name: "Export Project" }).click();
      expect(capturedBlob).not.toBeNull();
      const text = await (capturedBlob as unknown as Blob).text();
      expect(JSON.parse(text).customSnapPoints.map((p: { time: number }) => p.time)).toEqual([3, 9]);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("applies customSnapPoints from an imported project file to the store", async () => {
    useProjectStore.setState({ lines: [], customSnapPoints: snapPoints([1, 2]) });
    await render(<ExportPanel />);

    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      metadata: { title: "Imported", artists: [], album: "", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
      groups: [],
      granularity: "word" as const,
      customSnapPoints: [7, 8],
    };
    const file = new File([JSON.stringify(payload)], "p.ttml-project.json", { type: "application/json" });

    dispatchFileChange(getProjectImportInput(), file);

    await expect.poll(() => useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([7, 8]);
  });
});

describe("D10 export edits survive a remount", () => {
  it("keeps the hand-edited TTML after the Export panel remounts", async () => {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
    });
    const first = await render(<ExportPanel />);
    await first.getByRole("button", { name: /Edit$/ }).click();
    const textarea = first.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("Hello", "HELLO EDITED"));
    await first.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => document.body.textContent ?? "").toContain("HELLO EDITED");
    await first.rerender(<ExportPanel key="remounted" />);
    await expect.poll(() => document.body.textContent ?? "", { timeout: 2000 }).toContain("HELLO EDITED");
  });
});

function captureDownloads(): { names: string[]; restore: () => void } {
  const names: string[] = [];
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) names.push(this.download);
  };
  return {
    names,
    restore: () => {
      HTMLAnchorElement.prototype.click = originalClick;
    },
  };
}

describe("U8 invalid XML is exported without warning", () => {
  it("warns or blocks before downloading TTML that is not well-formed", async () => {
    useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 0, end: 1 })] });
    const screen = await render(<ExportPanel />);
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("</tt>", ""));
    await screen.getByRole("button", { name: "Done" }).click();

    const downloads = captureDownloads();
    try {
      await screen.getByRole("button", { name: /Download TTML/ }).click();
    } finally {
      downloads.restore();
    }
    const warned = /invalid|not well-formed|malformed|xml error/i.test(document.body.textContent ?? "");
    expect(warned || downloads.names.length === 0).toBe(true);
  });
});

describe("ExportPanel · invalid XML is blocked", () => {
  async function renderWithBrokenEdit() {
    useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 0, end: 1 })] });
    const screen = await render(
      <>
        <ExportPanel />
        <Toaster />
      </>,
    );
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    const generated = (textarea.element() as HTMLTextAreaElement).value;
    await textarea.fill(generated.replace("</tt>", ""));
    await screen.getByRole("button", { name: "Done" }).click();
    return screen;
  }

  it("does not copy invalid XML and explains why", async () => {
    const screen = await renderWithBrokenEdit();
    const clipboard = stubClipboard();
    try {
      await screen.getByRole("button", { name: "Copy" }).click();
      await expect.element(screen.getByText(/The TTML has an XML error: /)).toBeInTheDocument();
      expect(clipboard.writes).toEqual([]);
    } finally {
      clipboard.restore();
    }
  });

  it("does not download invalid XML and explains why", async () => {
    const screen = await renderWithBrokenEdit();
    const downloads = captureDownloads();
    try {
      await screen.getByRole("button", { name: /Download TTML/ }).click();
      await expect.element(screen.getByText(/The TTML has an XML error: /)).toBeInTheDocument();
      expect(downloads.names).toEqual([]);
    } finally {
      downloads.restore();
    }
  });

  it("does not clear the unexported-import flag when the export is blocked", async () => {
    const screen = await renderWithBrokenEdit();
    useProjectStore.setState({ hasUnexportedImport: true });
    const clipboard = stubClipboard();
    try {
      await screen.getByRole("button", { name: "Copy" }).click();
      await expect.element(screen.getByText(/The TTML has an XML error: /)).toBeInTheDocument();
      expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
    } finally {
      clipboard.restore();
    }
  });

  it("still copies valid XML", async () => {
    useProjectStore.setState({ lines: [createLine({ text: "Hello", begin: 0, end: 1 })] });
    const screen = await render(<ExportPanel />);
    const clipboard = stubClipboard();
    try {
      await screen.getByRole("button", { name: "Copy" }).click();
      await expect.poll(() => clipboard.writes.length).toBe(1);
      expect(clipboard.writes[0]).toContain("Hello");
    } finally {
      clipboard.restore();
    }
  });
});
