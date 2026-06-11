import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { TimelineHeader } from "@/views/timeline/timeline-header";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { render } from "@/test/render";

describe("TimelineHeader", () => {
  it("renders the Timeline heading and core toolbar buttons", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: /Follow/ })).toBeInTheDocument();
  });

  it("toggles followEnabled in the timeline store when the Follow button is clicked", async () => {
    const initial = useTimelineStore.getState().followEnabled;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Follow/ }).click();
    expect(useTimelineStore.getState().followEnabled).toBe(!initial);
  });

  it("does not render the Import button when onImportLyrics is omitted", async () => {
    const screen = await render(<TimelineHeader />);
    const importButton = Array.from(screen.container.querySelectorAll("button")).find((b) =>
      /^Import/i.test(b.textContent ?? ""),
    );
    expect(importButton).toBeUndefined();
  });

  it("invokes onImportLyrics when the Import button is clicked", async () => {
    let clicks = 0;
    const screen = await render(<TimelineHeader onImportLyrics={() => clicks++} />);
    await screen.getByRole("button", { name: /^Import/ }).click();
    expect(clicks).toBe(1);
  });

  it("renders the Rolling button", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("button", { name: /Rolling/ })).toBeInTheDocument();
  });

  it("renders the Rolling button with the ghost variant when rollingEditMode is off", async () => {
    useTimelineStore.setState({ rollingEditMode: false });
    const screen = await render(<TimelineHeader />);
    const rollingButton = screen.container.querySelector("button[title*='Rolling edit']") as HTMLElement;
    expect(rollingButton.className).toContain("opacity-60");
    expect(rollingButton.className).toContain("text-composer-text-muted");
  });

  it("renders the Rolling button with the primary variant when rollingEditMode is on", async () => {
    useTimelineStore.setState({ rollingEditMode: true });
    const screen = await render(<TimelineHeader />);
    const rollingButton = screen.container.querySelector("button[title*='Rolling edit']") as HTMLElement;
    expect(rollingButton.className).not.toContain("opacity-60");
    expect(rollingButton.className).toContain("bg-composer-accent-dark");
  });

  it("toggles rollingEditMode in the timeline store when the Rolling button is clicked", async () => {
    const initial = useTimelineStore.getState().rollingEditMode;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Rolling/ }).click();
    expect(useTimelineStore.getState().rollingEditMode).toBe(!initial);
  });

  it("renders the Snap button", async () => {
    const screen = await render(<TimelineHeader />);
    await expect.element(screen.getByRole("button", { name: /Snap/ })).toBeInTheDocument();
  });

  it("toggles settings.timelineSnap when the Snap button is clicked", async () => {
    const initial = useSettingsStore.getState().timelineSnap;
    const screen = await render(<TimelineHeader />);
    await screen.getByRole("button", { name: /Snap/ }).click();
    expect(useSettingsStore.getState().timelineSnap).toBe(!initial);
  });

  it("dims the Snap button when bypass is active", async () => {
    useTimelineStore.setState({ isBypassing: true });
    const screen = await render(<TimelineHeader />);
    const snapButton = screen.container.querySelector("button[title*='Snap']") as HTMLElement;
    expect(snapButton.className).toContain("opacity-50");
  });

  describe("zoom without a scroll ref", () => {
    it("renders without crashing", async () => {
      useTimelineStore.setState({ zoom: 100 });
      const screen = await render(<TimelineHeader />);
      expect(screen.container.querySelector("h2")?.textContent).toBe("Timeline");
    });

    it("clicking zoom in still increments zoom via the plain store action", async () => {
      useTimelineStore.setState({ zoom: 100 });
      const screen = await render(<TimelineHeader />);
      const buttons = Array.from(screen.container.querySelectorAll<HTMLButtonElement>("button"));
      const plus = buttons.at(-1);
      if (!plus) throw new Error("zoom + button not found");
      plus.click();
      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
    });
  });

  describe("zoom with a scroll ref (playhead-anchored)", () => {
    it("clicking zoom in goes through useTimelineZoom and adjusts scrollLeft", async () => {
      useTimelineStore.setState({ zoom: 100 });
      useAudioStore.setState({ currentTime: 5, audioElement: null });

      const ref = createRef<HTMLDivElement | null>();
      const screen = await render(
        <div>
          <div ref={ref} style={{ width: 800, height: 200, overflowX: "scroll" }} data-testid="scroll-host">
            <div style={{ width: 5000, height: 200 }} />
          </div>
          <TimelineHeader scrollContainerRef={ref} />
        </div>,
      );

      const host = ref.current;
      if (!host) throw new Error("ref did not attach");
      host.scrollLeft = 400;

      const beforePlayheadX = 5 * 100 - host.scrollLeft;

      const buttons = Array.from(screen.container.querySelectorAll<HTMLButtonElement>("button"));
      const plus = buttons.at(-1);
      if (!plus) throw new Error("zoom + button not found");
      plus.click();

      await expect.poll(() => useTimelineStore.getState().zoom).toBe(120);
      const afterPlayheadX = 5 * 120 - host.scrollLeft;
      expect(afterPlayheadX).toBeCloseTo(beforePlayheadX, 0);
    });
  });
});
