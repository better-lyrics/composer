import { FileDropArea } from "@/audio/file-drop-area";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

function drag(target: Element, type: "dragenter" | "dragleave" | "drop", file = createAudioFile()): void {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
}

const overlay = (container: HTMLElement) => container.querySelector("[data-file-drop-overlay]");

async function renderArea(onFileDrop: (file: File) => void = () => {}) {
  const screen = await render(
    <FileDropArea data-testid="area" onFileDrop={onFileDrop} dropLabel="Drop it">
      <span data-inner="">inner</span>
    </FileDropArea>,
  );
  const area = screen.container.querySelector('[data-testid="area"]');
  const inner = screen.container.querySelector("[data-inner]");
  if (!area || !inner) throw new Error("Area not rendered");
  return { screen, area, inner };
}

describe("FileDropArea", () => {
  it("shows its overlay while a file is over it", async () => {
    const { screen, area } = await renderArea();
    drag(area, "dragenter");
    await expect.element(screen.getByText("Drop it", { exact: true })).toBeInTheDocument();
  });

  it("hands a dropped file to onFileDrop", async () => {
    const dropped: string[] = [];
    const { area } = await renderArea((file) => dropped.push(file.name));
    drag(area, "drop", createAudioFile("song.wav"));
    expect(dropped).toEqual(["song.wav"]);
  });

  it("passes div props through", async () => {
    const { area } = await renderArea();
    expect(area.getAttribute("data-testid")).toBe("area");
    expect(area.className).toContain("relative");
  });

  describe("regressions", () => {
    it("regression: keeps the overlay while the drag moves over children", async () => {
      const { screen, area, inner } = await renderArea();
      drag(area, "dragenter");
      drag(inner, "dragenter");
      drag(area, "dragleave");
      await expect.poll(() => overlay(screen.container)).not.toBeNull();
    });

    it("regression: clears the overlay once every entered element is left, without relying on relatedTarget", async () => {
      const { screen, area, inner } = await renderArea();
      drag(area, "dragenter");
      drag(inner, "dragenter");
      drag(area, "dragleave");
      drag(inner, "dragleave");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });

    it("regression: clears the overlay after a drop on a child", async () => {
      const { screen, area, inner } = await renderArea();
      drag(area, "dragenter");
      drag(inner, "dragenter");
      drag(inner, "drop");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });
  });

  describe("invariants", () => {
    it("handles a drop on a child exactly once", async () => {
      const dropped: string[] = [];
      const { inner } = await renderArea((file) => dropped.push(file.name));
      drag(inner, "drop", createAudioFile("once.wav"));
      expect(dropped).toEqual(["once.wav"]);
    });
  });
});
