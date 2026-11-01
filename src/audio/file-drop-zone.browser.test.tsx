import { FileDropZone } from "@/audio/file-drop-zone";
import { UNSUPPORTED_AUDIO_FILE_MESSAGE } from "@/domain/audio-file/supported-formats";
import { createAudioFile } from "@/test/audio-fixtures";
import { dispatchDrag, dragFile } from "@/test/file-drag";
import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

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
    dragFile(label, "drop", file);
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
    dragFile(label, "drop", txt);
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
    dragFile(label, "drop", new File(["plain text"], "lyrics.txt", { type: "text/plain" }));
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

  it("highlights while a file is dragged over it and clears on leave", async () => {
    const screen = await render(
      <FileDropZone accept="audio/*" onFileDrop={() => {}}>
        drop
      </FileDropZone>,
    );
    const label = screen.container.querySelector("label");
    if (!label) throw new Error("Drop zone not rendered");
    dragFile(label, "dragenter", createAudioFile());
    await expect.poll(() => label.classList.contains("border-composer-accent")).toBe(true);
    dragFile(label, "dragleave", createAudioFile());
    await expect.poll(() => label.classList.contains("border-composer-accent")).toBe(false);
  });

  describe("several files", () => {
    async function renderZone(onFileDrop: (file: File) => void) {
      const screen = await render(
        <>
          <FileDropZone accept="audio/*" onFileDrop={onFileDrop}>
            <span>Drop</span>
          </FileDropZone>
          <Toaster />
        </>,
      );
      const label = screen.container.querySelector("label");
      if (!label) throw new Error("Drop zone not rendered");
      return { screen, label };
    }

    it("loads the first supported file and says only one song loads", async () => {
      const dropped: string[] = [];
      const { screen, label } = await renderZone((file) => dropped.push(file.name));
      const notes = new File(["x"], "notes.txt", { type: "text/plain" });
      dispatchDrag(label, "drop", { files: [notes, createAudioFile("first.wav"), createAudioFile("second.wav")] });
      expect(dropped).toEqual(["first.wav"]);
      await expect.element(screen.getByText("Only one song loads at a time")).toBeInTheDocument();
    });

    it("says nothing extra for a single file", async () => {
      const dropped: string[] = [];
      const { screen, label } = await renderZone((file) => dropped.push(file.name));
      dragFile(label, "drop", createAudioFile("only.wav"));
      expect(dropped).toEqual(["only.wav"]);
      await stepFrames(2);
      expect(screen.container.ownerDocument.body.textContent).not.toContain("Only one song loads at a time");
    });

    it("refuses several files when none is supported", async () => {
      const dropped: string[] = [];
      const { screen, label } = await renderZone((file) => dropped.push(file.name));
      const files = [
        new File(["x"], "a.txt", { type: "text/plain" }),
        new File(["x"], "b.txt", { type: "text/plain" }),
      ];
      dispatchDrag(label, "drop", { files });
      expect(dropped).toEqual([]);
      await expect.element(screen.getByText(UNSUPPORTED_AUDIO_FILE_MESSAGE)).toBeInTheDocument();
      expect(screen.container.ownerDocument.body.textContent).not.toContain("Only one song loads at a time");
    });
  });

  describe("links", () => {
    it("takes a song file dragged with a file link as a file drop", async () => {
      const dropped: string[] = [];
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={(file) => dropped.push(file.name)}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const label = screen.container.querySelector("label");
      if (!label) throw new Error("Drop zone not rendered");
      const fileManagerDrag = {
        files: [createAudioFile("song.wav")],
        data: { "text/uri-list": "file:///home/me/song.wav" },
      };
      expect(dispatchDrag(label, "dragover", fileManagerDrag).defaultPrevented).toBe(true);
      expect(dispatchDrag(label, "drop", fileManagerDrag).defaultPrevented).toBe(true);
      expect(dropped).toEqual(["song.wav"]);
    });
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
      dragFile(label, "drop", projectFile());
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
      dragFile(label, "drop", createAudioFile("song.wav"));
      expect(audio.map((f) => f.name)).toEqual(["song.wav"]);
    });

    it("lets the picker choose project files and names them in the input label", async () => {
      const screen = await render(
        <FileDropZone accept="audio/*" onFileDrop={() => {}} onProjectFileDrop={() => {}}>
          <span>Drop</span>
        </FileDropZone>,
      );
      const input = screen.getByLabelText("Upload audio or project file").element() as HTMLInputElement;
      expect(input.accept).toBe("audio/*,.composer,.json,.ttml-project.json");
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
      dragFile(label, "drop", new File(["plain text"], "lyrics.txt", { type: "text/plain" }));
      await expect
        .element(
          screen.getByText("Unsupported file type. Use .mp3 .wav .m4a .ogg .flac or a project file (.composer .json)"),
        )
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
      dragFile(label, "drop", projectFile());
      expect(audio).toEqual([]);
      expect(screen.getByLabelText("Upload audio file").elements()).toHaveLength(1);
    });
  });
});
