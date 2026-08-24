import { type DriveStep, driver } from "driver.js";
import { beforeEach, describe, expect, it } from "vitest";
import { GuideCard } from "@/tour/guide-card";
import { TOUR_GATED_STEPS, createTourSteps } from "@/tour/tour-steps";
import { useTour } from "@/tour/use-tour";
import { render } from "@/test/render";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

// -- Harness ------------------------------------------------------------------

function TourHarness() {
  const { startTour, guideCard, skipGuideCard } = useTour({ onOpenBestPractices: () => {} });
  return (
    <div>
      <button type="button" data-testid="start" onClick={() => startTour()}>
        Start
      </button>
      <GuideCard state={guideCard} onSkip={skipGuideCard} />
    </div>
  );
}

function HandoffHarness({ onOpen }: { onOpen: () => void }) {
  const { resumeOrStartTour } = useTour({ onOpenBestPractices: onOpen });
  return (
    <button type="button" data-testid="resume" onClick={() => resumeOrStartTour()}>
      Resume
    </button>
  );
}

// -- Driver popover helpers ---------------------------------------------------

const driverNextBtn = () => document.querySelector(".driver-popover-next-btn") as HTMLButtonElement | null;
const driverProgress = () => document.querySelector(".driver-popover-progress-text")?.textContent ?? "";
const driverTitle = () => document.querySelector(".driver-popover-title")?.textContent ?? "";

async function clickNext() {
  await expect.poll(() => driverNextBtn() !== null).toBe(true);
  driverNextBtn()?.click();
}

function setAudioLoaded() {
  useAudioStore.setState({ source: { type: "file", file: new File([], "x.mp3", { type: "audio/mpeg" }) } });
}

function setLyrics() {
  useProjectStore.setState({ lines: [createLine({ text: "hello world" })] });
}

function setLyricsSynced() {
  useProjectStore.setState({
    lines: [createLine({ text: "hello", begin: 0, end: 1, words: [{ text: "hello", begin: 0, end: 1 }] })],
  });
}

// -- Step order helpers -------------------------------------------------------

const BEST_PRACTICES_TITLE = "One thing before you do this for real";

function findByTitle(steps: DriveStep[], title: string) {
  return steps.find((step) => step.popover?.title === title);
}

function clickNextOn(step: DriveStep, steps: DriveStep[]) {
  step.popover?.onNextClick?.(undefined, step, { config: { steps }, state: {}, driver: driver({ steps }) });
}

// -- Tests --------------------------------------------------------------------

describe("createTourSteps", () => {
  it("places the best practices step immediately before the closing video", () => {
    const steps = createTourSteps(() => {});
    const videoIndex = steps.findIndex((s) => s.popover?.description?.includes("composer-tour-video-embed"));
    expect(videoIndex).toBeGreaterThan(0);
    expect(steps[videoIndex - 1]?.popover?.title).toBe(BEST_PRACTICES_TITLE);
  });

  it("puts the closing video last, so best practices is second to last", () => {
    const steps = createTourSteps(() => {});
    expect(steps[steps.length - 2]?.popover?.title).toBe(BEST_PRACTICES_TITLE);
    expect(steps[steps.length - 1]?.popover?.description).toContain("composer-tour-video-embed");
  });

  it("invokes the callback when the best practices step is actioned", () => {
    let opened = false;
    const steps = createTourSteps(() => {
      opened = true;
    });
    const step = findByTitle(steps, BEST_PRACTICES_TITLE);
    expect(step).toBeDefined();
    if (step) clickNextOn(step, steps);
    expect(opened).toBe(true);
  });

  it("binds the callback given to the call that built the steps", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const firstSteps = createTourSteps(() => firstCalls++);
    const secondSteps = createTourSteps(() => secondCalls++);

    const secondStep = findByTitle(secondSteps, BEST_PRACTICES_TITLE);
    if (secondStep) clickNextOn(secondStep, secondSteps);

    expect(secondCalls).toBe(1);
    expect(firstCalls).toBe(0);
    expect(findByTitle(firstSteps, BEST_PRACTICES_TITLE)).not.toBe(secondStep);
  });

  it("labels the best practices action Read them and keeps the back and close buttons", () => {
    const step = findByTitle(
      createTourSteps(() => {}),
      BEST_PRACTICES_TITLE,
    );
    expect(step?.popover?.nextBtnText).toBe("Read them");
    expect(step?.popover?.showButtons).toEqual(["previous", "next", "close"]);
  });

  it("anchors the best practices step to no element, so it reads as a modal", () => {
    const step = findByTitle(
      createTourSteps(() => {}),
      BEST_PRACTICES_TITLE,
    );
    expect(step?.element).toBeUndefined();
    expect(step?.popover?.popoverClass).toContain("composer-tour-modal");
  });

  it("leaves the gated step indices untouched", () => {
    expect(TOUR_GATED_STEPS.map((s) => s.stepIndex)).toEqual([2, 4, 6]);
  });

  it("keeps every gated index pointing at the step it was written to gate", () => {
    const steps = createTourSteps(() => {});
    const gatedTitles = TOUR_GATED_STEPS.map((gate) => steps[gate.stepIndex]?.popover?.title);
    expect(gatedTitles).toEqual(["Import your audio", "Add your lyrics", "Sync at least one line"]);
    expect(TOUR_GATED_STEPS.map((gate) => gate.tabId)).toEqual(["import", "edit", "sync"]);
  });

  it("keeps every gated step ahead of the best practices step", () => {
    const steps = createTourSteps(() => {});
    const bestPracticesIndex = steps.findIndex((s) => s.popover?.title === BEST_PRACTICES_TITLE);
    for (const gate of TOUR_GATED_STEPS) expect(gate.stepIndex).toBeLessThan(bestPracticesIndex);
  });

  it("gives each of its twelve steps a popover with a title", () => {
    const steps = createTourSteps(() => {});
    expect(steps).toHaveLength(12);
    for (const step of steps) expect(step.popover?.title?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

describe("useTour best practices handoff", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("closes the tour as it opens help, so nothing is left over the modal", async () => {
    const stepIndex = createTourSteps(() => {}).findIndex((s) => s.popover?.title === BEST_PRACTICES_TITLE);
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex }));
    let opened = 0;
    const screen = await render(<HandoffHarness onOpen={() => opened++} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe(BEST_PRACTICES_TITLE);
    expect(driverNextBtn()?.textContent).toBe("Read them");

    driverNextBtn()?.click();

    expect(opened).toBe(1);
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);
    expect(document.body.classList.contains("driver-active")).toBe(false);
  });
});

describe("useTour skipGuideCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("advances from the lyrics guide card to the Sync step even when the audio gate is also failing", async () => {
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await expect.poll(driverProgress).toBe("1 / 12");
    await clickNext();
    await expect.poll(driverProgress).toBe("2 / 12");
    await clickNext();
    // Audio gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 12");

    // Skip audio guide -> step 3 Edit "Type or paste lyrics" (4/12).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 12");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");

    // Step 3 -> step 4 gated lyrics -> guide card.
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 12");

    // BUG: skip jumps back to step 3 (4/12) because the skip logic re-scans gates
    // and picks the first failing one (audio), not the one the user is currently on.
    // FIX: skip advances to step 5 Sync (6/12).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 12");
    await expect.poll(driverTitle).toBe("Sync your lyrics");
  });

  it("skipping the audio guide card lands on the Edit step", async () => {
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 12");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 12");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");
  });

  it("skipping the lyrics guide card with audio loaded lands on the Sync step", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    // Audio gate passes -> driver auto-advances past step 2 to step 3 (Edit, 4/12).
    await expect.poll(driverProgress).toBe("4 / 12");

    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 12");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 12");
    await expect.poll(driverTitle).toBe("Sync your lyrics");
  });

  it("skipping the sync guide card lands on the Timeline step", async () => {
    setAudioLoaded();
    setLyrics();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 12");
    await clickNext();
    // Lyrics gate passes -> auto-advance to step 5 Sync (6/12).
    await expect.poll(driverProgress).toBe("6 / 12");
    await clickNext();
    // Sync gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 7 / 12");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("8 / 12");
    await expect.poll(driverTitle).toBe("Fine-tune on the timeline");
  });

  it("transitions from the lyrics guide card to the Sync step when lyrics get added", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 12");
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 12");

    // Populate lyrics. The gate poll detects the pass, flashes "Done!", then advances.
    setLyrics();

    await expect.poll(() => screen.container.textContent).toContain("Done!");
    // The advance is intentionally delayed by GATE_SUCCESS_DELAY (800ms) after "Done!",
    // so this needs more than the default 1000ms poll budget under load.
    await expect.poll(driverProgress, { timeout: 4000 }).toBe("6 / 12");
  });

  it("does not show the sync guide card when the sync gate already passes", async () => {
    setAudioLoaded();
    setLyricsSynced();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 12");
    await clickNext();
    await expect.poll(driverProgress).toBe("6 / 12");
    await clickNext();
    // Sync gate passes -> driver auto-advances past step 6. Guide card never appears.
    await expect.poll(() => screen.container.textContent?.includes("Step 7 / 12") ?? false).toBe(false);
  });
});
