import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { key } from "@/test/shared-timing-sync";
import { setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";
import { SyncPanel } from "@/views/sync/sync-panel";
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
async function renderBoundedPanel() {
  const ui = (
    <div style={{ height: LIST_HEIGHT_PX, display: "flex", flexDirection: "column" }}>
      <SyncPanel />
    </div>
  );
  const first = await render(ui);
  await installUtilitiesUsedIn(first.container);
  await first.unmount();
  return render(ui);
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
