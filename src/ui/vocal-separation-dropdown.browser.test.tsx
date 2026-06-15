import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { VocalSeparationDropdown } from "@/ui/vocal-separation-dropdown";

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
});
