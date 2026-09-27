import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { FileDropZone } from "@/audio/file-drop-zone";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";

function dispatchDragEvent(target: Element, type: string, files: File[] = []) {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(event);
}

describe("FileDropZone", () => {
  it("renders the file input and children", async () => {
    const screen = await render(
      <FileDropZone accept="audio/*" onFileDrop={() => {}}>
        <span>Drop audio here</span>
      </FileDropZone>,
    );
    await expect.element(screen.getByText("Drop audio here")).toBeInTheDocument();
    expect(screen.container.querySelector("input[type='file']")).not.toBeNull();
  });

  it("calls onFileDrop with a dropped audio file", async () => {
    let received: File | null = null;
    const screen = await render(
      <FileDropZone
        accept="audio/*"
        onFileDrop={(f) => {
          received = f;
        }}
      >
        <span>Drop here</span>
      </FileDropZone>,
    );
    const label = screen.container.querySelector("label") as HTMLLabelElement;
    const file = createAudioFile("song.wav");
    dispatchDragEvent(label, "drop", [file]);
    expect(received).not.toBeNull();
    expect((received as unknown as File).name).toBe("song.wav");
  });

  it("rejects files that are not audio (by extension or mime)", async () => {
    let received: File | null = null;
    const screen = await render(
      <FileDropZone
        accept="audio/*"
        onFileDrop={(f) => {
          received = f;
        }}
      >
        <span>Drop</span>
      </FileDropZone>,
    );
    const label = screen.container.querySelector("label") as HTMLLabelElement;
    const txt = new File(["plain text"], "lyrics.txt", { type: "text/plain" });
    dispatchDragEvent(label, "drop", [txt]);
    expect(received).toBeNull();
  });

  it("opens the file dialog when the label is activated (input is hidden but tied via htmlFor)", async () => {
    const screen = await render(
      <FileDropZone accept="audio/*" onFileDrop={() => {}}>
        <span>Drop here</span>
      </FileDropZone>,
    );
    const label = screen.container.querySelector("label") as HTMLLabelElement;
    const input = screen.container.querySelector("input[type='file']") as HTMLInputElement;
    expect(label.getAttribute("for")).toBe(input.id);
  });

  it("labels the hidden file input", async () => {
    const screen = await render(
      <FileDropZone accept="audio/*" onFileDrop={() => {}}>
        <span>Drop here</span>
      </FileDropZone>,
    );
    const input = screen.container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).toBe("Upload audio file");
  });

  it("tells the user which audio types are accepted when a dropped file is not audio", async () => {
    const screen = await render(
      <>
        <FileDropZone accept="audio/*" onFileDrop={() => {}}>
          <span>Drop</span>
        </FileDropZone>
        <Toaster />
      </>,
    );
    const label = screen.container.querySelector("label");
    if (!label) throw new Error("drop zone label not rendered");
    dispatchDragEvent(label, "drop", [new File(["plain text"], "lyrics.txt", { type: "text/plain" })]);
    await expect.element(screen.getByText("Unsupported file type. Use .mp3 .wav .m4a .ogg .flac")).toBeInTheDocument();
  });

  describe("regressions", () => {
    it("regression: clears the picked file so choosing the same file again fires change", async () => {
      const received: string[] = [];
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={(file) => received.push(file.name)}>
          <span>Drop here</span>
        </FileDropZone>,
      );
      await screen.getByLabelText("Upload audio file").upload(createAudioFile("song.wav"));

      expect(received).toEqual(["song.wav"]);
      expect((screen.getByLabelText("Upload audio file").element() as HTMLInputElement).value).toBe("");
    });

    it("regression: two drop zones on one page each open their own file input", async () => {
      const screen = await render(
        <>
          <FileDropZone accept="audio/*" onFileDrop={() => {}}>
            <span>First</span>
          </FileDropZone>
          <FileDropZone accept="audio/*" onFileDrop={() => {}}>
            <span>Second</span>
          </FileDropZone>
        </>,
      );
      const labels = [...screen.container.querySelectorAll("label")];
      const inputIds = labels.map((label) => label.querySelector("input")?.id);

      expect(new Set(inputIds).size).toBe(2);
      for (const label of labels) {
        expect(label.htmlFor).toBe(label.querySelector("input")?.id);
      }
    });
  });
});
