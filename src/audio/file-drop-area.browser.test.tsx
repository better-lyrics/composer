import { FileDropArea } from "@/audio/file-drop-area";
import { createAudioFile } from "@/test/audio-fixtures";
import { dragFile } from "@/test/file-drag";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

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
    dragFile(area, "dragenter");
    await expect.element(screen.getByText("Drop it", { exact: true })).toBeInTheDocument();
  });

  it("hands a dropped file to onFileDrop", async () => {
    const dropped: string[] = [];
    const { area } = await renderArea((file) => dropped.push(file.name));
    dragFile(area, "drop", createAudioFile("song.wav"));
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
      dragFile(area, "dragenter");
      dragFile(inner, "dragenter");
      dragFile(area, "dragleave");
      await expect.poll(() => overlay(screen.container)).not.toBeNull();
    });

    it("regression: clears the overlay once every entered element is left, without relying on relatedTarget", async () => {
      const { screen, area, inner } = await renderArea();
      dragFile(area, "dragenter");
      dragFile(inner, "dragenter");
      dragFile(area, "dragleave");
      dragFile(inner, "dragleave");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });

    it("regression: clears the overlay when an entered child is replaced during the drag", async () => {
      const { screen, area, inner } = await renderArea();
      const spinner = document.createElement("span");
      inner.append(spinner);
      dragFile(area, "dragenter");
      dragFile(spinner, "dragenter");
      await expect.poll(() => overlay(screen.container)).not.toBeNull();
      spinner.replaceWith(document.createElement("span"));
      dragFile(area, "dragleave");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });

    it("regression: clears the overlay when the drag ends elsewhere in the window", async () => {
      const { screen, area } = await renderArea();
      dragFile(area, "dragenter");
      await expect.poll(() => overlay(screen.container)).not.toBeNull();
      dragFile(window, "dragend");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });

    it("regression: clears the overlay after a drop outside the area", async () => {
      const { screen, area } = await renderArea();
      dragFile(area, "dragenter");
      await expect.poll(() => overlay(screen.container)).not.toBeNull();
      dragFile(document.body, "drop");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });

    it("regression: clears the overlay after a drop on a child", async () => {
      const { screen, area, inner } = await renderArea();
      dragFile(area, "dragenter");
      dragFile(inner, "dragenter");
      dragFile(inner, "drop");
      await expect.poll(() => overlay(screen.container)).toBeNull();
    });
  });

  describe("invariants", () => {
    it("handles a drop on a child exactly once", async () => {
      const dropped: string[] = [];
      const { inner } = await renderArea((file) => dropped.push(file.name));
      dragFile(inner, "drop", createAudioFile("once.wav"));
      expect(dropped).toEqual(["once.wav"]);
    });
  });
});
