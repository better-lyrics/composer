import { appQueryClient } from "@/lib/app-query-client";
import { openModalCount, useEscapeLayerStackStore } from "@/stores/escape-layer-stack";
import { useImportModalStore } from "@/stores/import-modal-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { stepFrames } from "@/test/frame-steps";
import { emulateReducedMotion } from "@/test/reduced-motion";
import { render } from "@/test/render";
import { GuideCard } from "@/tour/guide-card";
import { TOUR_STEP_IDS } from "@/tour/tour-steps";
import { TOUR_RESUME_KEY, useTour } from "@/tour/use-tour";
import { restoreProvidersForTests, snapshotProvidersForTests } from "@/utils/lyrics-search/registry";
import type { LyricsSearchProvider } from "@/utils/lyrics-search/types";
import { LyricsImportModalHost } from "@/views/lyrics-import-modal/lyrics-import-modal-host";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
// The app loads driver.js's stylesheet through the tour theme; without it the overlay swallows clicks meant for the modal.
import "driver.js/dist/driver.css";
import { userEvent } from "vitest/browser";

// -- Harness ------------------------------------------------------------------

function ImportTourHarness() {
  const { resumeOrStartTour, guideCard, skipGuideCard } = useTour({ onOpenBestPractices: () => {} });
  return (
    <QueryClientProvider client={appQueryClient}>
      <button type="button" data-testid="resume" onClick={() => resumeOrStartTour()}>
        Resume
      </button>
      <button type="button" data-tour="import-lyrics-button">
        Import Lyrics
      </button>
      <LyricsImportModalHost />
      <GuideCard state={guideCard} onSkip={skipGuideCard} />
    </QueryClientProvider>
  );
}

// -- Helpers ------------------------------------------------------------------

const driverTitle = () => document.querySelector(".driver-popover-title")?.textContent ?? "";
const driverButton = (selector: string) => document.querySelector<HTMLButtonElement>(selector);
const importDialog = () => document.querySelector('[data-tour="lyrics-import-modal"]')?.closest("dialog") ?? null;

async function resumeAt(stepId: (typeof TOUR_STEP_IDS)[number]) {
  const stepIndex = TOUR_STEP_IDS.indexOf(stepId);
  localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex, stepCount: TOUR_STEP_IDS.length }));
  const screen = await render(<ImportTourHarness />);
  await screen.getByTestId("resume").click();
  return screen;
}

// driver.js ignores button clicks until the step's highlight transition has run its frames.
async function clickDriver(selector: string) {
  await expect.poll(() => driverButton(selector) !== null).toBe(true);
  await stepFrames(2);
  driverButton(selector)?.click();
}

const DRIVER_TRANSITION_MS = 400;

let providerSnapshot: readonly LyricsSearchProvider[] = [];

beforeAll(() => emulateReducedMotion("reduce"));
afterAll(() => emulateReducedMotion("no-preference"));

beforeEach(() => {
  localStorage.clear();
  providerSnapshot = snapshotProvidersForTests();
  restoreProvidersForTests([]);
  useSettingsStore.setState({ autoExtractBackgroundVocals: false });
});

afterEach(() => {
  restoreProvidersForTests(providerSnapshot);
});

// -- Tests --------------------------------------------------------------------

describe("tour Import Lyrics steps", () => {
  it("highlights the Import Lyrics button on the Edit tab", async () => {
    useProjectStore.setState({ activeTab: "sync" });
    const screen = await resumeAt("edit-import");
    await expect.poll(driverTitle).toBe("Import lyrics you already have");
    await expect.element(screen.getByRole("button", { name: "Import Lyrics" })).toHaveClass("driver-active-element");
    expect(useProjectStore.getState().activeTab).toBe("edit");
    expect(importDialog()).toBeNull();
  });

  it("Next opens the Import Lyrics modal and highlights it", async () => {
    await resumeAt("edit-import");
    await expect.poll(driverTitle).toBe("Import lyrics you already have");
    await clickDriver(".driver-popover-next-btn");
    await expect.poll(driverTitle).toBe("Search, paste, or upload");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
  });

  it("resuming on the modal step opens the modal", async () => {
    await resumeAt("edit-import-modal");
    await expect.poll(driverTitle).toBe("Search, paste, or upload");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
  });

  it("Next closes the modal and continues to the lyrics gate", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog() !== null).toBe(true);
    await clickDriver(".driver-popover-next-btn");
    await expect.poll(importDialog).toBeNull();
    await expect.poll(() => screen.container.textContent).toContain("Type or paste lyrics");
    expect(useImportModalStore.getState().isOpen).toBe(false);
  });

  it("Back closes the modal and returns to the button step", async () => {
    await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog() !== null).toBe(true);
    await clickDriver(".driver-popover-prev-btn");
    await expect.poll(driverTitle).toBe("Import lyrics you already have");
    await expect.poll(importDialog).toBeNull();
  });

  it("lets the user type into the modal while the tour points at it", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
    const track = screen.getByLabelText("Track");
    await track.click();
    await userEvent.keyboard("Midnight City");
    await expect.element(track).toHaveValue("Midnight City");
  });

  it("regression: arrow keys inside a modal field move the caret and leave the tour where it is", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
    const track = screen.getByLabelText("Track");
    await track.click();
    await userEvent.keyboard("Midnight City{ArrowLeft}{ArrowLeft}{ArrowRight}");
    await stepFrames(2);
    expect(driverTitle()).toBe("Search, paste, or upload");
    expect(importDialog()).not.toBeNull();
    await expect.element(track).toHaveValue("Midnight City");
  });

  it("regression: arrow keyups in a field still reach the field and document listeners", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
    const track = screen.getByLabelText("Track");
    await track.click();
    const fieldKeys: string[] = [];
    const documentKeys: string[] = [];
    const onField = (event: Event) => {
      if (event instanceof KeyboardEvent) fieldKeys.push(event.key);
    };
    const onDocument = (event: KeyboardEvent) => documentKeys.push(event.key);
    track.element().addEventListener("keyup", onField);
    document.addEventListener("keyup", onDocument);
    try {
      await userEvent.keyboard("{ArrowLeft}");
      expect(fieldKeys).toContain("ArrowLeft");
      expect(documentKeys).toContain("ArrowLeft");
      expect(driverTitle()).toBe("Search, paste, or upload");
    } finally {
      track.element().removeEventListener("keyup", onField);
      document.removeEventListener("keyup", onDocument);
    }
  });

  it("keeps arrow keys stepping the tour when no field has focus", async () => {
    await resumeAt("edit-import");
    await expect.poll(driverTitle).toBe("Import lyrics you already have");
    await stepFrames(2);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(driverTitle).toBe("Search, paste, or upload");
  });

  it("moves on when the modal is closed from its own Cancel button", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
    await screen.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(() => screen.container.textContent).toContain("Type or paste lyrics");
    expect(document.querySelector(".driver-popover")).toBeNull();
  });

  it("lands on the next step when lyrics are imported from the modal during the tour", async () => {
    const screen = await resumeAt("edit-import-modal");
    await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
    await screen.getByRole("button", { name: "Paste lyrics" }).click();
    await screen.getByLabelText("Lyrics text").fill("Waiting in a car\nWaiting for a ride in the dark");
    await screen.getByRole("button", { name: /^Import$/ }).click();
    await expect.poll(() => useProjectStore.getState().lines.length).toBe(2);
    await expect.poll(driverTitle, { timeout: 4000 }).toBe("Translate and transliterate");
  });

  describe("lifecycle", () => {
    it("closing the tour on the modal step closes the modal and releases every modal entry", async () => {
      await resumeAt("edit-import-modal");
      await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
      await clickDriver(".driver-popover-close-btn");
      await expect.poll(() => document.querySelector(".driver-popover")).toBeNull();
      await expect.poll(importDialog).toBeNull();
      await expect.poll(() => openModalCount(useEscapeLayerStackStore.getState())).toBe(0);
    });

    it("regression: closing the tour while it is still moving onto the modal step closes the modal", async () => {
      await emulateReducedMotion("no-preference");
      try {
        await resumeAt("edit-import");
        await expect.poll(driverTitle).toBe("Import lyrics you already have");
        await new Promise((resolve) => setTimeout(resolve, DRIVER_TRANSITION_MS));
        await stepFrames(2);
        driverButton(".driver-popover-next-btn")?.click();
        await expect.poll(driverTitle).toBe("Search, paste, or upload");
        driverButton(".driver-popover-close-btn")?.click();
        await expect.poll(() => document.querySelector(".driver-popover")).toBeNull();
        await expect.poll(importDialog).toBeNull();
        expect(useImportModalStore.getState().isOpen).toBe(false);
      } finally {
        await emulateReducedMotion("reduce");
      }
    });

    it("Escape ends the tour and closes the modal", async () => {
      await resumeAt("edit-import-modal");
      await expect.poll(() => importDialog()?.classList.contains("driver-active-element")).toBe(true);
      await userEvent.keyboard("{Escape}");
      await expect.poll(importDialog).toBeNull();
      await expect.poll(() => document.querySelector(".driver-popover")).toBeNull();
      await expect.poll(() => openModalCount(useEscapeLayerStackStore.getState())).toBe(0);
    });
  });
});
