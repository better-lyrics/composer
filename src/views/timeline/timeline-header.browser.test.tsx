import { describe, expect, it } from "vitest";
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
});
