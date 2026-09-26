import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";
import { createFrameProbe, type FrameProbe } from "@/test/frame-probe";
import { settleFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { SyncPanel } from "@/views/sync/sync-panel";

// -- Harness -------------------------------------------------------------------

let disposeWiring: (() => void) | null = null;
let probe: FrameProbe;

function seedEditableProject(): HTMLAudioElement {
  const audioElement = document.createElement("audio");
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 10, currentTime: 0 });
  useAudioStore.getState().registerAudioElement(audioElement);
  useProjectStore.setState({
    granularity: "word",
    lines: [
      createLine({
        text: "Hello world",
        words: [
          { text: "Hello ", begin: 1, end: 3 },
          { text: "world", begin: 3, end: 5 },
        ],
      }),
    ],
  });
  return audioElement;
}

function wordProgress(root: HTMLElement, begin: number): string | undefined {
  return root.querySelector<HTMLElement>(`[data-word-begin='${begin}']`)?.style.width;
}

beforeEach(() => {
  disposeWiring = wireFrameLoop();
  probe = createFrameProbe();
});

afterEach(() => {
  probe.dispose();
  disposeWiring?.();
  disposeWiring = null;
});

// -- Tests ---------------------------------------------------------------------

describe("SyncPanel on the frame loop", () => {
  it("widens the word progress while the audio plays in edit mode", async () => {
    const audioElement = seedEditableProject();
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.poll(() => wordProgress(screen.container, 1)).toBe("0%");

    useAudioStore.getState().setIsPlaying(true);
    audioElement.currentTime = 2;

    await expect.poll(() => wordProgress(screen.container, 1)).toBe("50%");
  });

  it("widens the word progress after a seek while paused in edit mode", async () => {
    seedEditableProject();
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.poll(() => wordProgress(screen.container, 1)).toBe("0%");

    useAudioStore.getState().seekTo(4);

    await expect.poll(() => wordProgress(screen.container, 3)).toBe("50%");
    expect(wordProgress(screen.container, 1)).toBe("100%");
  });

  it("resumes widening after edit mode is left and entered again", async () => {
    seedEditableProject();
    const screen = await render(<SyncPanel />);
    await screen.getByRole("button", { name: "Edit" }).click();
    useAudioStore.getState().seekTo(4);
    await expect.poll(() => wordProgress(screen.container, 3)).toBe("50%");

    await screen.getByRole("button", { name: "Done" }).click();
    await expect.poll(() => wordProgress(screen.container, 3)).toBeUndefined();

    useAudioStore.getState().seekTo(2);
    await screen.getByRole("button", { name: "Edit" }).click();

    await expect.poll(() => wordProgress(screen.container, 1)).toBe("50%");
  });

  describe("invariants", () => {
    it("regression #174: stops running frames once edit mode settles while paused", async () => {
      seedEditableProject();
      const screen = await render(<SyncPanel />);
      await screen.getByRole("button", { name: "Edit" }).click();
      await expect.poll(() => wordProgress(screen.container, 1)).toBe("0%");
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });

    it("regression #174: stops running frames while edit mode is off", async () => {
      seedEditableProject();
      await render(<SyncPanel />);
      await probe.quiesce();

      await settleFrames(probe.count);
      expect(probe.count()).toBe(0);
    });
  });
});
