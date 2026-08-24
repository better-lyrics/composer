import { beforeEach, describe, expect, it } from "vitest";
import { GuideCard } from "@/tour/guide-card";
import { BEST_PRACTICES_STEP_TITLE, createTourSteps } from "@/tour/tour-steps";
import { useTour } from "@/tour/use-tour";
import { render } from "@/test/render";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { allowConsole } from "@/test/console-guard";

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
const VIDEO_BTN_CLASS = "composer-tour-video-btn";
const driverWatchBtn = () => document.querySelector(`.${VIDEO_BTN_CLASS}`) as HTMLButtonElement | null;

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

// -- Tests --------------------------------------------------------------------

describe("useTour best practices handoff", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("closes the tour as it opens help, so nothing is left over the modal", async () => {
    const steps = createTourSteps(() => {});
    const stepIndex = steps.findIndex((s) => s.popover?.title === BEST_PRACTICES_STEP_TITLE);
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex, stepCount: steps.length }));
    let opened = 0;
    const screen = await render(<HandoffHarness onOpen={() => opened++} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe(BEST_PRACTICES_STEP_TITLE);
    expect(driverNextBtn()?.textContent).toBe("Read them");

    driverNextBtn()?.click();

    expect(opened).toBe(1);
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);
    expect(document.body.classList.contains("driver-active")).toBe(false);
  });
});

describe("useTour watch the closing walkthrough", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  async function resumeOntoBestPractices(screen: Awaited<ReturnType<typeof render>>) {
    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe(BEST_PRACTICES_STEP_TITLE);
  }

  function seedResumeAtBestPractices() {
    const steps = createTourSteps(() => {});
    const stepIndex = steps.findIndex((s) => s.popover?.title === BEST_PRACTICES_STEP_TITLE);
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex, stepCount: steps.length }));
  }

  it("offers a control that reaches the closing video", async () => {
    seedResumeAtBestPractices();
    const screen = await render(<HandoffHarness onOpen={() => {}} />);
    await resumeOntoBestPractices(screen);

    expect(driverWatchBtn()?.textContent).toBe("Watch the video");
    driverWatchBtn()?.click();

    await expect.poll(driverTitle).toBe("See a full walkthrough");
    await expect.poll(() => document.querySelector(".composer-tour-video-embed")).not.toBe(null);
  });

  it("keeps the control off every other step", async () => {
    const screen = await render(<TourHarness />);
    await screen.getByTestId("start").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    expect(driverWatchBtn()).toBe(null);
  });

  it("does not stack duplicate controls when the step re-renders", async () => {
    seedResumeAtBestPractices();
    const screen = await render(<HandoffHarness onOpen={() => {}} />);
    await resumeOntoBestPractices(screen);

    window.dispatchEvent(new Event("resize"));
    await expect.poll(() => document.querySelectorAll(`.${VIDEO_BTN_CLASS}`).length).toBe(1);
  });
});

describe("useTour resume payload", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resumes an index written against the current step list", async () => {
    const steps = createTourSteps(() => {});
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex: 9, stepCount: steps.length }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Export your TTML");
  });

  it("discards an index written against a different step list", async () => {
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex: 9, stepCount: 4 }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("discards a legacy payload that carries no step count", async () => {
    localStorage.setItem("composer-tour-resume", JSON.stringify({ stepIndex: 9 }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("discards an unreadable payload rather than throwing", async () => {
    allowConsole(/tour resume state/);
    localStorage.setItem("composer-tour-resume", "{ not json");
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
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
