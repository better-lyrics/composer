import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { key } from "@/test/shared-timing-sync";
import { stepFrames } from "@/test/frame-steps";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
import { Activity } from "react";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const LIST_HEIGHT_PX = 600;
const CENTRED_WITHIN_PX = 40;

function loadLongSong(): void {
  useSettingsStore.setState({ syncCountIn: 0 });
  useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 4000, currentTime: 0 });
  const lines = Array.from({ length: 2000 }, (_, index) =>
    createLine({ text: `Line ${index + 1} ${"walking under neon ".repeat(1 + (index % 7))}`.trim() }),
  );
  useProjectStore.setState({ lines, activeTab: "sync", granularity: "line" });
}

// Tailwind is compiled from a first mount, so the list's scroll container is height-bound and windowing is real.
function boundedPanel(mode: "visible" | "hidden" = "visible") {
  return (
    <Activity mode={mode}>
      <div style={{ height: LIST_HEIGHT_PX, display: "flex", flexDirection: "column" }}>
        <SyncPanel />
      </div>
    </Activity>
  );
}

async function renderBoundedPanel() {
  const first = await render(boundedPanel());
  await installUtilitiesUsedIn(first.container);
  await first.unmount();
  return render(boundedPanel());
}

// Read after layout and before paint of the next frame, like a frame the user sees.
function linesInViewNextFrame(scroller: HTMLElement): Promise<number[]> {
  return new Promise((resolve) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      probe.remove();
      const view = scroller.getBoundingClientRect();
      const rows = [...scroller.querySelectorAll<HTMLElement>("[data-sync-line]")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > view.top && rect.top < view.bottom;
      });
      resolve(rows.map((row) => Number(row.dataset.syncLine)));
    });
    observer.observe(probe);
  });
}

function lineRow(container: HTMLElement, lineNumber: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-sync-line="${lineNumber}"]`);
}

function rowOffsetFromCentre(scroller: HTMLElement, row: HTMLElement | null): number {
  if (!row) return Number.POSITIVE_INFINITY;
  const rowRect = row.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  return Math.abs(rowRect.top + rowRect.height / 2 - (scrollerRect.top + scrollerRect.height / 2));
}

// -- Tests --------------------------------------------------------------------

describe("SyncLineList", () => {
  it("regression: a list revealed by Activity shows its rows in the first frame, where it was left", async () => {
    loadLongSong();
    const screen = await renderBoundedPanel();
    await expect.poll(() => lineRow(screen.container, 1)).not.toBeNull();
    const scroller = lineRow(screen.container, 1)?.closest<HTMLElement>(".overflow-y-auto");
    if (!scroller) throw new Error("no sync line list scroller");
    scroller.scrollTop = 1500;
    await expect.poll(() => lineRow(screen.container, 46)).not.toBeNull();
    await stepFrames(10);
    const linesBefore = await linesInViewNextFrame(scroller);
    expect(linesBefore).not.toContain(1);

    await screen.rerender(boundedPanel("hidden"));
    await stepFrames(10);
    await screen.rerender(boundedPanel("visible"));

    expect(await linesInViewNextFrame(scroller)).toEqual(linesBefore);
    await stepFrames(10);
    expect(await linesInViewNextFrame(scroller)).toEqual(linesBefore);
  });

  it("regression: pausing after a tap far down the song centres the current line", async () => {
    loadLongSong();
    const screen = await renderBoundedPanel();
    const scroller = () => {
      const row = screen.container.querySelector<HTMLElement>("[data-sync-line]");
      const element = row?.closest<HTMLElement>(".overflow-y-auto");
      if (!element) throw new Error("no sync line list scroller");
      return element;
    };

    await expect
      .poll(() => {
        if (lineRow(screen.container, 300)) return true;
        scroller().scrollTop += LIST_HEIGHT_PX;
        return false;
      })
      .toBe(true);
    lineRow(screen.container, 300)?.click();
    await expect.poll(() => lineRow(screen.container, 300)?.getAttribute("aria-current")).toBe("true");

    setIsPlaying(true);
    setCurrentTime(300);
    key({ key: " ", code: "Space" });
    await expect.poll(() => useProjectStore.getState().lines[299].begin).toBe(300);
    setIsPlaying(false);

    await expect
      .poll(() => rowOffsetFromCentre(scroller(), lineRow(screen.container, 301)))
      .toBeLessThan(CENTRED_WITHIN_PX);
    expect(lineRow(screen.container, 301)?.getAttribute("aria-current")).toBe("true");
  });
});
