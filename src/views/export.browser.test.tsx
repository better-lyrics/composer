import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { LYRICS_CODE_CSS, installStyleSheet } from "@/test/browser-css";
import { stubClipboard } from "@/test/clipboard";
import { createLine, createWord, snapPoints } from "@/test/factories";
import { render } from "@/test/render";
import { resolvedColor } from "@/test/resolved-color";
import { ExportPanel } from "@/views/export";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

describe("ExportPanel preview highlight", () => {
  let sheet: HTMLStyleElement;

  beforeEach(() => {
    sheet = installStyleSheet(LYRICS_CODE_CSS);
    useProjectStore.setState({
      lines: [createLine({ text: "Hi", words: [createWord({ text: "Hi", begin: 0, end: 1 })] })],
    });
  });

  afterEach(() => {
    sheet.remove();
    document.documentElement.style.removeProperty("--color-composer-text");
    document.documentElement.style.removeProperty("--color-composer-accent-text");
  });

  it("highlights the TTML on a transparent bordered pane", async () => {
    const screen = await render(<ExportPanel />);
    await expect.poll(() => screen.container.querySelector("pre.bh .bh-tag")).not.toBe(null);
    const pre = screen.container.querySelector("pre.bh");
    if (!pre) throw new Error("highlighted preview not rendered");
    expect(pre.classList.contains("lyrics-code-surface")).toBe(true);
    expect(pre.classList.contains("select-text")).toBe(true);
    expect([...pre.querySelectorAll(".bh-tag")].map((tag) => tag.textContent)).toContain("tt");
  });

  it.each(["default", "light"])(
    "resolves token colours through the composer theme variables in the %s theme",
    async (themeId) => {
      useThemeStore.setState({ activeThemeId: themeId });
      const root = document.documentElement;
      root.style.setProperty("--color-composer-text", "rgb(7, 8, 9)");
      root.style.setProperty("--color-composer-accent-text", "rgb(1, 2, 3)");
      const screen = await render(<ExportPanel />);
      await expect.poll(() => screen.container.querySelector("pre.bh .bh-timestamp")).not.toBe(null);
      const pre = screen.container.querySelector("pre.bh");
      const timestamp = screen.container.querySelector("pre.bh .bh-timestamp");
      if (!pre || !timestamp) throw new Error("highlighted preview not rendered");
      expect(getComputedStyle(pre).color).toBe("rgb(7, 8, 9)");
      expect(getComputedStyle(timestamp).color).toBe(
        resolvedColor("color-mix(in srgb, rgb(1, 2, 3) 80%, rgb(7, 8, 9))"),
      );
    },
  );
});

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

  it("opens an imported project file as its own new project, carrying over its customSnapPoints", async () => {
    useProjectStore.setState({ lines: [], customSnapPoints: snapPoints([1, 2]) });
    await render(<ExportPanel />);
    const previousId = openProjectIdSnapshot();

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

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Imported");
    expect(useProjectStore.getState().customSnapPoints.map((p) => p.time)).toEqual([7, 8]);
    expect(openProjectIdSnapshot()).not.toBe(previousId);
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

describe("ExportPanel · project file keeps the hand-edited TTML with its project", () => {
  const STALE_EDIT = { source: "<tt>a</tt>", content: "<tt>a edited</tt>" };
  const SAVED_EDIT = { source: "<tt>b</tt>", content: "<tt>b edited</tt>" };

  function projectFile(extra: Record<string, unknown> = {}): File {
    const payload = {
      version: 3 as const,
      savedAt: Date.now(),
      metadata: { title: "Project B", artists: [], album: "Album B", duration: 0 },
      agents: DEFAULT_AGENTS,
      lines: [createLine({ text: "B", words: [createWord({ text: "B", begin: 0, end: 1 })] })],
      groups: [],
      granularity: "word" as const,
      ...extra,
    };
    return new File([JSON.stringify(payload)], "b.ttml-project.json", { type: "application/json" });
  }

  async function renderWithProjectA(): Promise<Awaited<ReturnType<typeof render>>> {
    useSettingsStore.setState({ confirmReplaceLyrics: false });
    useProjectStore.setState({
      lines: [createLine({ text: "A", words: [createWord({ text: "A", begin: 0, end: 1 })] })],
      ttmlEditState: STALE_EDIT,
      importedMetadataKeys: ["title"],
    });
    return render(<ExportPanel />);
  }

  async function exportedProjectText(screen: Awaited<ReturnType<typeof render>>): Promise<string> {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const blobs: Blob[] = [];
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) blobs.push(obj);
      return "blob:stub";
    };
    URL.revokeObjectURL = () => {};
    try {
      await screen.getByRole("button", { name: "Export Project" }).click();
      await expect.poll(() => blobs.length).toBe(1);
      return await blobs[0].text();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  }

  it("drops the previous project's edit when a file without an edit is opened", async () => {
    await renderWithProjectA();

    dispatchFileChange(getProjectImportInput(), projectFile());

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Project B");
    expect(useProjectStore.getState().ttmlEditState).toBeNull();
  });

  it("restores the edit saved in the opened file", async () => {
    await renderWithProjectA();

    dispatchFileChange(getProjectImportInput(), projectFile({ ttmlEditState: SAVED_EDIT }));

    await expect.poll(() => useProjectStore.getState().ttmlEditState).toEqual(SAVED_EDIT);
  });

  it("restores the imported song detail keys saved in the opened file", async () => {
    await renderWithProjectA();

    dispatchFileChange(getProjectImportInput(), projectFile({ importedMetadataKeys: ["album"] }));

    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Project B");
    expect(useProjectStore.getState().importedMetadataKeys).toEqual(["album"]);
  });

  it("keeps the edit and the imported keys through an export and import round trip", async () => {
    const screen = await renderWithProjectA();
    const text = await exportedProjectText(screen);
    useProjectStore.setState({ ttmlEditState: null, importedMetadataKeys: [] });

    dispatchFileChange(getProjectImportInput(), new File([text], "a.ttml-project.json", { type: "application/json" }));

    await expect.poll(() => useProjectStore.getState().ttmlEditState).toEqual(STALE_EDIT);
    expect(useProjectStore.getState().importedMetadataKeys).toEqual(["title"]);
  });

  describe("invariants", () => {
    it("leaves the opened project clean and flagged as an unexported import", async () => {
      await renderWithProjectA();

      dispatchFileChange(getProjectImportInput(), projectFile({ ttmlEditState: SAVED_EDIT }));

      await expect.poll(() => useProjectStore.getState().ttmlEditState).toEqual(SAVED_EDIT);
      expect(useProjectStore.getState().isDirty).toBe(false);
      expect(useProjectStore.getState().hasUnexportedImport).toBe(true);
    });
  });
});

describe("ExportPanel · Done applies TTML edits to the project", () => {
  async function renderEditing() {
    useProjectStore.setState({
      lines: [createLine({ text: "Hello", begin: 0, end: 1 }), createLine({ text: "World", begin: 1, end: 2 })],
      ttmlEditState: null,
    });
    const screen = await render(
      <>
        <ExportPanel />
        <Toaster />
      </>,
    );
    await screen.getByRole("button", { name: /Edit$/ }).click();
    const textarea = screen.getByRole("textbox", { name: "Edit TTML content" });
    return { screen, textarea, generated: (textarea.element() as HTMLTextAreaElement).value };
  }

  it("updates the lyrics every tab reads and drops the export override", async () => {
    const { screen, textarea, generated } = await renderEditing();
    await textarea.fill(generated.replace(">Hello<", ">Hello there<"));
    await screen.getByRole("button", { name: "Done" }).click();
    await expect
      .poll(() => useProjectStore.getState().lines.map((line) => line.text))
      .toEqual(["Hello there", "World"]);
    expect(useProjectStore.getState().ttmlEditState).toBeNull();
    await expect.element(screen.getByText("Updated the lyrics from the TTML")).toBeInTheDocument();
  });

  it("takes a whole pasted TTML document", async () => {
    const { screen, textarea } = await renderEditing();
    await textarea.fill(
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:05.000" end="00:06.000">Pasted in</p></div></body></tt>',
    );
    await screen.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Pasted in"]);
    expect(useProjectStore.getState().lines[0]?.begin).toBe(5);
  });

  describe("error paths", () => {
    it("keeps the edit as the export only, and says so, when the TTML has no readable lines", async () => {
      const { screen, textarea } = await renderEditing();
      await textarea.fill("CUSTOM EDITED CONTENT");
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByText(/only change the exported file/)).toBeInTheDocument();
      expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(["Hello", "World"]);
      expect(useProjectStore.getState().ttmlEditState?.content).toBe("CUSTOM EDITED CONTENT");
    });
  });

  describe("edge cases", () => {
    it("changes nothing when Done is clicked without an edit", async () => {
      const { screen } = await renderEditing();
      const before = useProjectStore.getState().lines;
      await screen.getByRole("button", { name: "Done" }).click();
      await expect.element(screen.getByRole("button", { name: /Edit$/ })).toBeInTheDocument();
      expect(useProjectStore.getState().lines).toBe(before);
      expect(screen.getByText("Updated the lyrics from the TTML").elements()).toHaveLength(0);
    });
  });
});
