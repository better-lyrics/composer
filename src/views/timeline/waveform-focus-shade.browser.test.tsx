import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WaveformFocusShade } from "@/views/timeline/waveform-focus-shade";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

beforeEach(() => {
  useAudioStore.setState({ duration: 60 });
  useTimelineStore.setState({ zoom: 10 });
  useProjectStore.setState({
    groups: [createGroup({ id: "g1", label: "Chorus", color: "#ff0000", sharesTiming: true })],
    lines: [chorus(0, 10), chorus(1, 40)],
  });
});

let utilities: HTMLStyleElement | undefined;

afterEach(() => {
  utilities?.remove();
  utilities = undefined;
});

// -- Queries ------------------------------------------------------------------

function shade(side: "before" | "after"): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-waveform-focus-shade="${side}"]`);
}

// -- Tests --------------------------------------------------------------------

describe("WaveformFocusShade", () => {
  it("renders nothing while no group is open", async () => {
    await render(<WaveformFocusShade />);

    expect(shade("before")).toBeNull();
    expect(shade("after")).toBeNull();
  });

  it("shades the waveform before and after the open instance", async () => {
    useTimelineStore.getState().openGroup("g1", 1);
    await render(<WaveformFocusShade />);

    await expect.poll(() => shade("before")?.style.width).toBe("400px");
    expect(shade("after")?.style.left).toBe("420px");
    expect(shade("after")?.style.width).toBe("180px");
  });

  it("follows the zoom", async () => {
    useTimelineStore.getState().openGroup("g1", 0);
    await render(<WaveformFocusShade />);

    useTimelineStore.setState({ zoom: 20 });

    await expect.poll(() => shade("before")?.style.width).toBe("200px");
    expect(shade("after")?.style.left).toBe("240px");
  });

  it("disappears when the group closes", async () => {
    useTimelineStore.getState().openGroup("g1", 0);
    await render(<WaveformFocusShade />);
    await expect.poll(() => shade("before")).not.toBeNull();

    useTimelineStore.getState().closeGroup();

    await expect.poll(() => shade("before")).toBeNull();
  });

  describe("edge cases", () => {
    it("lets clicks pass through to the waveform", async () => {
      useTimelineStore.getState().openGroup("g1", 0);
      const screen = await render(<WaveformFocusShade />);
      await expect.poll(() => shade("before")).not.toBeNull();
      utilities = await installUtilitiesUsedIn(screen.container);

      expect(getComputedStyle(shade("before") as HTMLElement).pointerEvents).toBe("none");
      expect(getComputedStyle(shade("after") as HTMLElement).pointerEvents).toBe("none");
    });

    it("never gives the after shade a negative width when the instance runs past the audio", async () => {
      useAudioStore.setState({ duration: 41 });
      useTimelineStore.getState().openGroup("g1", 1);
      await render(<WaveformFocusShade />);

      await expect.poll(() => shade("after")?.style.width).toBe("0px");
    });

    it("renders nothing before the audio duration is known", async () => {
      useAudioStore.setState({ duration: 0 });
      useTimelineStore.getState().openGroup("g1", 0);
      await render(<WaveformFocusShade />);

      expect(shade("before")).toBeNull();
    });

    it("renders nothing when the open instance has no timing", async () => {
      useProjectStore.setState({
        lines: [
          chorus(0, 10),
          createLine({ id: "c1", text: "go now", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 }),
        ],
      });
      useTimelineStore.getState().openGroup("g1", 1);
      await render(<WaveformFocusShade />);

      expect(shade("before")).toBeNull();
    });
  });
});
