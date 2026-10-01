import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { VocalSeparationDropdown } from "@/ui/vocal-separation-dropdown";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Vocal Separation Dropdown ------------------------------------------------

describe("VocalSeparationDropdown", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_VOCAL_MODEL_BASE_URL", "https://models.test");
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile() });
    useSeparationStore.setState({
      status: "ready",
      modelCached: true,
      hostingConfigured: true,
      availableStems: ["original", "vocals", "instrumental"],
      currentStem: "vocals",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the onset snap toggle inside the ready-state stem controls", async () => {
    const screen = await render(<VocalSeparationDropdown />);
    await screen.getByRole("button", { name: "Vocal separation" }).click();

    const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
    await expect.element(toggle).toBeInTheDocument();
  });

  it("renders the toggle after the stem-selection controls", async () => {
    const screen = await render(<VocalSeparationDropdown />);
    await screen.getByRole("button", { name: "Vocal separation" }).click();

    const stemButton = screen.getByRole("button", { name: "Original" });
    const toggle = screen.getByRole("switch", { name: "Snap to vocal onsets" });
    await expect.element(stemButton).toBeInTheDocument();
    await expect.element(toggle).toBeInTheDocument();

    const stemEl = stemButton.element();
    const toggleEl = toggle.element();
    expect(stemEl.compareDocumentPosition(toggleEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggleEl.closest(".border-t")).not.toBeNull();
  });

  it("shows download progress in megabytes with a labelled progress bar", async () => {
    useSeparationStore.setState({ status: "downloading", progress: { loaded: 1_048_576, total: 4_194_304 } });
    const screen = await render(<VocalSeparationDropdown />);
    await screen.getByRole("button", { name: "Vocal separation" }).click();

    await expect.element(screen.getByText("1.0 MB / 4.0 MB")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Downloading model…" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "25");
  });

  describe("vocal onset detection", () => {
    it("shows a spinner and the detection label on the trigger while onsets are detected", async () => {
      useTimelineStore.getState().setVocalOnsetDetectionStatus("processing");
      const screen = await render(<VocalSeparationDropdown />);

      const trigger = screen.getByRole("button", { name: "Vocal separation, detecting vocal onsets" });
      await expect.element(trigger).toHaveTextContent("Detecting vocal onsets");
      expect(trigger.element().querySelector(".animate-spin")).not.toBeNull();
    });

    it("announces detection through a status region", async () => {
      const screen = await render(<VocalSeparationDropdown />);
      const status = screen.getByRole("status");
      await expect.element(status).toHaveTextContent("");

      useTimelineStore.getState().setVocalOnsetDetectionStatus("processing");
      await expect.element(status).toHaveTextContent("Detecting vocal onsets");

      useTimelineStore.getState().setVocalOnsetDetectionStatus("idle");
      await expect.element(status).toHaveTextContent("");
    });

    it("returns to the stem label once detection finishes", async () => {
      useTimelineStore.getState().setVocalOnsetDetectionStatus("processing");
      const screen = await render(<VocalSeparationDropdown />);
      await expect.element(screen.getByRole("button", { name: /detecting vocal onsets/ })).toBeInTheDocument();

      useTimelineStore.getState().setVocalOnsetDetectionStatus("idle");

      const trigger = screen.getByRole("button", { name: "Vocal separation" });
      await expect.element(trigger).toHaveTextContent("Vocals");
      expect(trigger.element().querySelector(".animate-spin")).toBeNull();
    });

    describe("edge cases", () => {
      it("keeps the separation percentage when separation and detection overlap", async () => {
        useSeparationStore.setState({ status: "processing", progress: { loaded: 1, total: 4 } });
        useTimelineStore.getState().setVocalOnsetDetectionStatus("processing");
        const screen = await render(<VocalSeparationDropdown />);

        await expect.element(screen.getByRole("button", { name: "Vocal separation" })).toHaveTextContent("25%");
      });

      it("does not show detection after a detection error", async () => {
        useTimelineStore.getState().setVocalOnsetDetectionStatus("error", "bad stem");
        const screen = await render(<VocalSeparationDropdown />);

        await expect.element(screen.getByRole("button", { name: "Vocal separation" })).toHaveTextContent("Vocals");
        await expect.element(screen.getByRole("status")).toHaveTextContent("");
      });
    });
  });
});
