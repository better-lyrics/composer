import { FileDropZone } from "@/audio/file-drop-zone";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

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

describe("FileDropZone ids", () => {
  it("gives every drop zone its own input so each label opens its own picker", async () => {
    const screen = await render(
      <>
        <FileDropZone accept="audio/*" onFileDrop={() => {}}>
          first
        </FileDropZone>
        <FileDropZone accept="audio/*" onFileDrop={() => {}}>
          second
        </FileDropZone>
        <FileDropZone accept="audio/*" onFileDrop={() => {}}>
          third
        </FileDropZone>
      </>,
    );
    const labels = [...screen.container.querySelectorAll("label")];
    expect(labels).toHaveLength(3);
    for (const label of labels) {
      expect(label.querySelector("input")?.id).toBe(label.htmlFor);
    }
    const ids = labels.map((label) => label.htmlFor);
    expect(new Set(ids).size).toBe(labels.length);
  });

  it("merges a className over its defaults", async () => {
    const screen = await render(
      <FileDropZone accept="audio/*" onFileDrop={() => {}} className="p-3.5">
        drop
      </FileDropZone>,
    );
    const label = screen.container.querySelector("label");
    expect(label?.classList.contains("p-3.5")).toBe(true);
    expect(label?.classList.contains("p-8")).toBe(false);
  });

  describe("project files", () => {
    function projectFile(name = "song.ttml-project.json") {
      return new File(["{}"], name, { type: "application/json" });
    }

    it("hands a dropped project file to onProjectFileDrop, not onFileDrop", async () => {
      const audio: File[] = [];
      const projects: File[] = [];
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={(f) => audio.push(f)} onProjectFileDrop={(f) => projects.push(f)}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const label = screen.container.querySelector("label") as HTMLLabelElement;
      dispatchDragEvent(label, "drop", [projectFile()]);
      expect(projects.map((f) => f.name)).toEqual(["song.ttml-project.json"]);
      expect(audio).toEqual([]);
    });

    it("still hands audio to onFileDrop when it also takes project files", async () => {
      const audio: File[] = [];
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={(f) => audio.push(f)} onProjectFileDrop={() => {}}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const label = screen.container.querySelector("label") as HTMLLabelElement;
      dispatchDragEvent(label, "drop", [createAudioFile("song.wav")]);
      expect(audio.map((f) => f.name)).toEqual(["song.wav"]);
    });

    it("lets the picker choose project files and names them in the input label", async () => {
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={() => {}} onProjectFileDrop={() => {}}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const input = screen.getByLabelText("Upload audio or project file").element() as HTMLInputElement;
      expect(input.accept).toBe("audio/*,.json,.ttml-project.json");
    });

    it("names project files in the message for a file it cannot use", async () => {
      const screen = await render(
        <>
          <FileDropZone accept="audio/*" onFileDrop={() => {}} onProjectFileDrop={() => {}}>
            <span>Drop</span>
          </FileDropZone>
          <Toaster />
        </>,
      );
      const label = screen.container.querySelector("label") as HTMLLabelElement;
      dispatchDragEvent(label, "drop", [new File(["plain text"], "lyrics.txt", { type: "text/plain" })]);
      await expect
        .element(screen.getByText("Unsupported file type. Use .mp3 .wav .m4a .ogg .flac or a project file (.json)"))
        .toBeInTheDocument();
    });

    it("regression: an audio-only drop zone still rejects a project file", async () => {
      const audio: File[] = [];
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={(f) => audio.push(f)}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const label = screen.container.querySelector("label") as HTMLLabelElement;
      dispatchDragEvent(label, "drop", [projectFile()]);
      expect(audio).toEqual([]);
      expect(screen.getByLabelText("Upload audio file").elements()).toHaveLength(1);
    });
  });
});
