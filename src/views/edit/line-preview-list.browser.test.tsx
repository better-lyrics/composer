import { useProjectStore } from "@/stores/project";
import { installUtilitiesUsedIn } from "@/test/browser-css";
import { createLine } from "@/test/factories";
import { stepFrames } from "@/test/frame-steps";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";
import { Activity } from "react";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PANEL_HEIGHT_PX = 600;

function loadLongLyrics(): void {
  const lines = Array.from({ length: 2000 }, (_, index) =>
    createLine({ text: `Line ${index + 1} ${"paper lanterns drifting ".repeat(1 + (index % 3))}`.trim() }),
  );
  useProjectStore.setState({ lines, activeTab: "edit" });
}

function boundedPanel(mode: "visible" | "hidden" = "visible") {
  return (
    <Activity mode={mode}>
      <div style={{ height: PANEL_HEIGHT_PX, display: "flex", flexDirection: "column" }}>
        <EditPanel />
      </div>
    </Activity>
  );
}

// Tailwind is compiled from a first mount, so the preview's scroll parent is height-bound and windowing is real.
async function renderBoundedPanel() {
  const first = await render(boundedPanel());
  await installUtilitiesUsedIn(first.container);
  await first.unmount();
  return render(boundedPanel());
}

function previewRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="line-preview-text"]')];
}

// Read after layout and before paint of the next frame, like a frame the user sees.
function linesInViewNextFrame(scroller: HTMLElement): Promise<string[]> {
  return new Promise((resolve) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      probe.remove();
      const view = scroller.getBoundingClientRect();
      const inView = previewRows(scroller).filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > view.top && rect.top < view.bottom;
      });
      resolve(inView.map((row) => row.textContent ?? ""));
    });
    observer.observe(probe);
  });
}

// -- Tests --------------------------------------------------------------------

describe("LinePreviewList", () => {
  it("regression: a list revealed by Activity shows its rows in the first frame, where it was left", async () => {
    loadLongLyrics();
    const screen = await renderBoundedPanel();
    await expect.poll(() => previewRows(screen.container).length).toBeGreaterThan(0);
    const scroller = previewRows(screen.container)[0].closest<HTMLElement>("[data-list-scroll-parent]");
    if (!scroller) throw new Error("no preview scroll parent");
    expect(previewRows(screen.container).length).toBeLessThan(200);

    scroller.scrollTop = 30_000;
    await expect
      .poll(() => previewRows(screen.container).some((row) => row.textContent?.startsWith("Line 1 ")))
      .toBe(false);
    await stepFrames(10);
    const linesBefore = await linesInViewNextFrame(scroller);
    expect(linesBefore.length).toBeGreaterThan(0);

    useProjectStore.setState({ activeTab: "sync" });
    await screen.rerender(boundedPanel("hidden"));
    await stepFrames(10);
    useProjectStore.setState({ activeTab: "edit" });
    await screen.rerender(boundedPanel("visible"));

    expect(await linesInViewNextFrame(scroller)).toEqual(linesBefore);
    await stepFrames(10);
    expect(await linesInViewNextFrame(scroller)).toEqual(linesBefore);
  });
});
