import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { WANDERLUST_QRC } from "@/test/qrc-fixtures";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

/** The on-disk QRC document uses CRLF, so drop the bytes exactly as QQ Music serves them. */
const WANDERLUST_QRC_CRLF = WANDERLUST_QRC.replace(/\n/g, "\r\n");

function getEditPanel(): HTMLElement {
  const node = document.querySelector('[data-tour="edit-panel"]');
  if (!node) throw new Error("edit panel not found");
  return node as HTMLElement;
}

function dropFile(target: Element, file: File): void {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel file drop", () => {
  it("imports a dropped QRC document into the project store", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File([WANDERLUST_QRC_CRLF], "wanderlust.qrc", { type: "text/plain" }));

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
    expect(useProjectStore.getState().agents).toHaveLength(2);
    expect(useProjectStore.getState().agents.map((a) => a.name)).toContain("The Weeknd");
    expect(useProjectStore.getState().metadata.title).toBe("Wanderlust");
  });

  it("keeps word-level timing from a dropped QRC document", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File([WANDERLUST_QRC_CRLF], "wanderlust.qrc", { type: "text/plain" }));

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
    const withWords = useProjectStore.getState().lines.filter((line) => (line.words?.length ?? 0) > 0);
    expect(withWords.length).toBe(84);
  });

  it("imports a QRC document served under the .xml alias extension", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File([WANDERLUST_QRC_CRLF], "wanderlust.xml", { type: "text/xml" }));

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
  });

  it("imports a dropped .lrc file", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File(["[00:01.00]Hello\n[00:03.00]World"], "song.lrc", { type: "text/plain" }));

    await expect.poll(() => useProjectStore.getState().lines.map((l) => l.text)).toEqual(["Hello", "World"]);
  });

  it("ignores a dropped file whose extension the app cannot parse", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File(["binary"], "cover.png", { type: "image/png" }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useProjectStore.getState().lines).toEqual([]);
  });

  it("accepts an uppercase extension on a dropped file", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    dropFile(getEditPanel(), new File([WANDERLUST_QRC_CRLF], "WANDERLUST.QRC", { type: "text/plain" }));

    await expect.poll(() => useProjectStore.getState().lines.length).toBe(84);
  });

  it("ignores a drop that carries no file", async () => {
    useProjectStore.setState({ lines: [] });
    await render(<EditPanel />);

    getEditPanel().dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useProjectStore.getState().lines).toEqual([]);
  });
});

describe("EditPanel placeholder copy", () => {
  it("names every supported lyrics format in the textarea placeholder", async () => {
    useProjectStore.setState({ lines: [] });
    const screen = await render(<EditPanel />);
    const textarea = (await screen.container.querySelector("textarea")) as HTMLTextAreaElement | null;
    if (!textarea) throw new Error("lyrics textarea not found");
    for (const label of [".txt", ".lrc", ".srt", ".ttml", ".qrc"]) {
      expect(textarea.placeholder).toContain(label);
    }
  });
});
