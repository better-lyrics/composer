import { useProjectStore } from "@/stores/project";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createGroup, createLine, createWord } from "@/test/factories";
import { render } from "@/test/render";
import { SeekBarFocusBand } from "@/views/timeline/seek-bar-focus-band";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorus = (instanceIdx: number, begin: number, end: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "go",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [createWord({ text: "go", begin, end })],
  });

let utilities: HTMLStyleElement | undefined;

beforeEach(() => {
  useProjectStore.setState({
    activeTab: "timeline",
    groups: [createGroup({ id: "g1", label: "Chorus", sharesTiming: true })],
    lines: [chorus(0, 10, 20), chorus(1, 50, 60)],
  });
});

afterEach(() => {
  utilities?.remove();
  utilities = undefined;
});

// -- Queries ------------------------------------------------------------------

const band = () => document.querySelector<HTMLElement>("[data-seek-bar-focus-band]");

// -- Tests --------------------------------------------------------------------

describe("SeekBarFocusBand", () => {
  it("renders nothing while no group is open", async () => {
    await render(<SeekBarFocusBand duration={100} />);

    expect(band()).toBeNull();
  });

  it("spans the open instance as a share of the song", async () => {
    useTimelineStore.getState().openGroup("g1", 1);
    await render(<SeekBarFocusBand duration={100} />);

    await expect.poll(() => band()?.style.left).toBe("50%");
    expect(band()?.style.width).toBe("10%");
  });

  it("follows the heard instance", async () => {
    useTimelineStore.getState().openGroup("g1", 0);
    await render(<SeekBarFocusBand duration={100} />);
    await expect.poll(() => band()?.style.left).toBe("10%");

    useTimelineStore.getState().openGroup("g1", 1);

    await expect.poll(() => band()?.style.left).toBe("50%");
  });

  it("disappears when the group closes", async () => {
    useTimelineStore.getState().openGroup("g1", 0);
    await render(<SeekBarFocusBand duration={100} />);
    await expect.poll(band).not.toBeNull();

    useTimelineStore.getState().closeGroup();

    await expect.poll(band).toBeNull();
  });

  describe("edge cases", () => {
    it("renders nothing off the Timeline tab", async () => {
      useProjectStore.setState({ activeTab: "sync" });
      useTimelineStore.getState().openGroup("g1", 0);
      await render(<SeekBarFocusBand duration={100} />);

      expect(band()).toBeNull();
    });

    it("renders nothing before the duration is known", async () => {
      useTimelineStore.getState().openGroup("g1", 0);
      await render(<SeekBarFocusBand duration={0} />);

      expect(band()).toBeNull();
    });

    it("stops at the end of the song when the instance runs past it", async () => {
      useTimelineStore.getState().openGroup("g1", 1);
      await render(<SeekBarFocusBand duration={55} />);

      await expect.poll(() => Number.parseFloat(band()?.style.left ?? "")).toBeCloseTo((50 / 55) * 100);
      expect(Number.parseFloat(band()?.style.width ?? "")).toBeCloseTo((5 / 55) * 100);
    });

    it("never catches clicks meant for the seek bar", async () => {
      useTimelineStore.getState().openGroup("g1", 0);
      const screen = await render(<SeekBarFocusBand duration={100} />);
      await expect.poll(band).not.toBeNull();
      utilities = await installUtilitiesUsedIn(screen.container);

      expect(getComputedStyle(band() as HTMLElement).pointerEvents).toBe("none");
    });
  });
});
