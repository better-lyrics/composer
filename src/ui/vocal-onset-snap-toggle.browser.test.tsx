import { describe, expect, it } from "vitest";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { render } from "@/test/render";
import { VocalOnsetSnapToggle } from "@/ui/vocal-onset-snap-toggle";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Vocal Onset Snap Toggle --------------------------------------------------

describe("VocalOnsetSnapToggle", () => {
  it("reflects the current vocalOnsetSnap setting", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    const screen = await render(<VocalOnsetSnapToggle />);
    const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("flips the setting off when clicked while on", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: true });
    const screen = await render(<VocalOnsetSnapToggle />);
    const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
    await toggle.click();
    await expect.poll(() => useSettingsStore.getState().vocalOnsetSnap).toBe(false);
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("flips the setting on when clicked while off", async () => {
    useSettingsStore.setState({ vocalOnsetSnap: false });
    const screen = await render(<VocalOnsetSnapToggle />);
    const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
    await toggle.click();
    await expect.poll(() => useSettingsStore.getState().vocalOnsetSnap).toBe(true);
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  });

  // -- Status hint ------------------------------------------------------------

  describe("status hint", () => {
    it("shows a detecting hint while detection is processing", async () => {
      useTimelineStore.setState({ vocalOnsetDetectionStatus: "processing" });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Detecting onsets...")).toBeInTheDocument();
    });

    it("shows the snap point count when points exist", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "idle",
        vocalOnsetSnapPoints: [0.1, 0.5, 1.2],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("3 snap points")).toBeInTheDocument();
    });

    it("surfaces the specific error message when detection errored", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "error",
        vocalOnsetDetectionError: "worker terminated unexpectedly",
        vocalOnsetSnapPoints: [],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Detection failed: worker terminated unexpectedly")).toBeInTheDocument();
    });

    it("falls back to a generic failure hint when no error message exists", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "error",
        vocalOnsetDetectionError: null,
        vocalOnsetSnapPoints: [],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Detection failed")).toBeInTheDocument();
    });

    it("shows the muted separate-vocals hint when nothing is detected", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "idle",
        vocalOnsetSnapPoints: [],
        vocalOnsetDetectionError: null,
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Separate vocals to detect onsets")).toBeInTheDocument();
    });

    it("prefers the processing hint over an existing point count", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "processing",
        vocalOnsetSnapPoints: [0.2, 0.4],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Detecting onsets...")).toBeInTheDocument();
    });

    it("surfaces an error over stale points from a prior successful run", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "error",
        vocalOnsetDetectionError: "decode failed",
        vocalOnsetSnapPoints: [0.2, 0.4, 0.6],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("Detection failed: decode failed")).toBeInTheDocument();
    });
  });

  // -- Invariants -------------------------------------------------------------

  describe("invariants", () => {
    it("does not trigger separation or onset detection when toggled", async () => {
      useSettingsStore.setState({ vocalOnsetSnap: false });
      useSeparationStore.setState({ status: "ready", availableStems: ["original", "vocals"] });
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "idle",
        vocalOnsetSnapPoints: [0.3, 0.9],
      });

      const screen = await render(<VocalOnsetSnapToggle />);
      const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
      await toggle.click();

      await expect.poll(() => useSettingsStore.getState().vocalOnsetSnap).toBe(true);
      expect(useSeparationStore.getState().status).toBe("ready");
      expect(useTimelineStore.getState().vocalOnsetDetectionStatus).toBe("idle");
      expect(useTimelineStore.getState().vocalOnsetSnapPoints).toEqual([0.3, 0.9]);
    });

    it("uses the singular noun for a single snap point", async () => {
      useTimelineStore.setState({
        vocalOnsetDetectionStatus: "idle",
        vocalOnsetSnapPoints: [0.42],
      });
      const screen = await render(<VocalOnsetSnapToggle />);
      await expect.element(screen.getByText("1 snap point")).toBeInTheDocument();
    });
  });
});
