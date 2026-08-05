import { describe, expect, it } from "vitest";
import { SyncPanel } from "@/views/sync/sync-panel";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { firePointer, loadPlayingProject, setCurrentTime, setIsPlaying } from "@/test/sync-gesture-helpers";

describe("SyncPanel · hold drained when the circles unmount", () => {
  it("closes the held word when the song ends mid-hold", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    firePointer(screen.getByRole("button", { name: "Hold to sync" }).element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(5);

    setCurrentTime(7);
    setIsPlaying(false);

    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(7);
  });

  it("leaves the next tap behaving as a tap after the song ended mid-hold", async () => {
    loadPlayingProject();
    const screen = await render(<SyncPanel />);

    firePointer(screen.getByRole("button", { name: "Hold to sync" }).element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);

    setCurrentTime(7);
    setIsPlaying(false);
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[0]?.end).toBe(7);

    setIsPlaying(true);
    setCurrentTime(9);
    const holdCircle = screen.getByRole("button", { name: "Hold to sync" });
    await expect.poll(() => holdCircle.element().getAttribute("aria-pressed")).toBe("false");

    firePointer(screen.getByRole("button", { name: "Tap to sync" }).element(), "pointerdown");

    // A tap closes the word it writes; a hold-tap would leave end === begin.
    await expect.poll(() => useProjectStore.getState().lines[0].words?.[1]?.begin).toBe(9);
    const tapped = useProjectStore.getState().lines[0].words?.[1];
    expect(tapped?.end).toBeGreaterThan(9);
  });

  it("drains the hold when a hold-tap completes the song", async () => {
    loadPlayingProject("Hello");
    const screen = await render(<SyncPanel />);

    firePointer(screen.getByRole("button", { name: "Hold to sync" }).element(), "pointerdown");
    await expect.poll(() => useProjectStore.getState().lines[0].words?.length).toBe(1);

    setCurrentTime(7);
    firePointer(screen.getByRole("button", { name: "Tap to sync" }).element(), "pointerdown");
    await expect.element(screen.getByText("Sync complete!")).toBeInTheDocument();

    const existing = useProjectStore.getState().lines;
    useProjectStore.setState({ lines: [...existing, createLine({ text: "World" })] });

    await expect
      .poll(() => screen.getByRole("button", { name: "Hold to sync" }).element().getAttribute("aria-pressed"))
      .toBe("false");
  });
});
