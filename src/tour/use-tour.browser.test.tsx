import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAudioStore } from "@/stores/audio";
import { isAnyModalOpen, useModalStackStore } from "@/stores/modal-stack";
import { useProjectStore } from "@/stores/project";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { GuideCard } from "@/tour/guide-card";
import { BEST_PRACTICES_STEP_TITLE, createTourSteps } from "@/tour/tour-steps";
import { TOUR_RESUME_KEY, TOUR_SEEN_KEY, resetTour, useTour } from "@/tour/use-tour";
import { beforeEach, describe, expect, it } from "vitest";

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

function ShortcutsHarness() {
  const { resumeOrStartTour, startTour } = useTour({ onOpenBestPractices: () => {} });
  useGlobalShortcuts({
    setActiveTab: (tab) => useProjectStore.getState().setActiveTab(tab),
    setHelpOpen: () => {},
    setSettingsOpen: () => {},
  });
  return (
    <div>
      <button type="button" data-testid="resume" onClick={() => resumeOrStartTour()}>
        Resume
      </button>
      <button type="button" data-testid="start" onClick={() => startTour()}>
        Start
      </button>
    </div>
  );
}

// -- Driver popover helpers ---------------------------------------------------

const driverNextBtn = () => document.querySelector(".driver-popover-next-btn") as HTMLButtonElement | null;
const driverProgress = () => document.querySelector(".driver-popover-progress-text")?.textContent ?? "";
const driverTitle = () => document.querySelector(".driver-popover-title")?.textContent ?? "";
const driverCloseBtn = () => document.querySelector<HTMLButtonElement>(".driver-popover-close-btn");
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
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex, stepCount: steps.length }));
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
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex, stepCount: steps.length }));
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
    const exportIndex = steps.findIndex((step) => step.popover?.title === "Export your TTML");
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: exportIndex, stepCount: steps.length }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Export your TTML");
  });

  it("discards an index written against a different step list", async () => {
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: 9, stepCount: 4 }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("discards a legacy payload that carries no step count", async () => {
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: 9 }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("discards an unreadable payload rather than throwing", async () => {
    allowConsole(/tour resume state/);
    localStorage.setItem(TOUR_RESUME_KEY, "{ not json");
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
    await expect.poll(driverProgress).toBe("1 / 13");
    await clickNext();
    await expect.poll(driverProgress).toBe("2 / 13");
    await clickNext();
    // Audio gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 13");

    // Skip audio guide -> step 3 Edit "Type or paste lyrics" (4/13).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 13");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");

    // Step 3 -> step 4 gated lyrics -> guide card.
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 13");

    // BUG: skip jumps back to step 3 (4/13) because the skip logic re-scans gates
    // and picks the first failing one (audio), not the one the user is currently on.
    // FIX: skip advances to step 5 Languages (6/13).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 13");
    await expect.poll(driverTitle).toBe("Translate and transliterate");
  });

  it("skipping the audio guide card lands on the Edit step", async () => {
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 13");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 13");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");
  });

  it("skipping the lyrics guide card with audio loaded lands on the Languages step", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    // Audio gate passes -> driver auto-advances past step 2 to step 3 (Edit, 4/13).
    await expect.poll(driverProgress).toBe("4 / 13");

    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 13");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 13");
    await expect.poll(driverTitle).toBe("Translate and transliterate");
  });

  it("skipping the sync guide card lands on the Timeline step", async () => {
    setAudioLoaded();
    setLyrics();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 13");
    await clickNext();
    // Lyrics gate passes -> auto-advance to step 5 Languages (6/13).
    await expect.poll(driverProgress).toBe("6 / 13");
    await clickNext();
    await expect.poll(driverProgress).toBe("7 / 13");
    await expect.poll(driverTitle).toBe("Sync your lyrics");
    await clickNext();
    // Sync gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 8 / 13");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("9 / 13");
    await expect.poll(driverTitle).toBe("Fine-tune on the timeline");
  });

  it("transitions from the lyrics guide card to the Languages step when lyrics get added", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 13");
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 13");

    // Populate lyrics. The gate poll detects the pass, flashes "Done!", then advances.
    setLyrics();

    await expect.poll(() => screen.container.textContent).toContain("Done!");
    // The advance is intentionally delayed by GATE_SUCCESS_DELAY (800ms) after "Done!",
    // so this needs more than the default 1000ms poll budget under load.
    await expect.poll(driverProgress, { timeout: 4000 }).toBe("6 / 13");
    await expect.poll(driverTitle).toBe("Translate and transliterate");
  });

  it("does not show the sync guide card when the sync gate already passes", async () => {
    setAudioLoaded();
    setLyricsSynced();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 13");
    await clickNext();
    await expect.poll(driverProgress).toBe("6 / 13");
    await clickNext();
    await expect.poll(driverProgress).toBe("7 / 13");
    await clickNext();
    await expect.poll(driverProgress).toBe("9 / 13");
    await expect.poll(driverTitle).toBe("Fine-tune on the timeline");
    expect(screen.container.textContent).not.toContain("Step 8 / 13");
    expect(screen.container.textContent).not.toContain("Sync at least one line");
  });
});

describe("useTour lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restarts from Welcome after the user finishes the tour on the last step", async () => {
    const steps = createTourSteps(() => {});
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: steps.length - 1, stepCount: steps.length }));
    const screen = await render(<ShortcutsHarness />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("See a full walkthrough");
    driverCloseBtn()?.click();
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("restarts from Welcome after the best practices handoff ends the tour", async () => {
    const steps = createTourSteps(() => {});
    const stepIndex = steps.findIndex((s) => s.popover?.title === BEST_PRACTICES_STEP_TITLE);
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex, stepCount: steps.length }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe(BEST_PRACTICES_STEP_TITLE);
    driverNextBtn()?.click();
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
  });

  it("keeps the resume point when the tour is closed partway through", async () => {
    const steps = createTourSteps(() => {});
    const exportIndex = steps.findIndex((step) => step.popover?.title === "Export your TTML");
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: exportIndex, stepCount: steps.length }));
    const screen = await render(<HandoffHarness onOpen={() => {}} />);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Export your TTML");
    driverCloseBtn()?.click();
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);

    await screen.getByTestId("resume").click();
    await expect.poll(driverTitle).toBe("Export your TTML");
  });

  it("does not switch tabs with Mod+digit while a tour popover is open", async () => {
    const screen = await render(<ShortcutsHarness />);
    await screen.getByTestId("start").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    expect(useProjectStore.getState().activeTab).toBe("import");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "4", metaKey: true, ctrlKey: true, bubbles: true }));
    expect(useProjectStore.getState().activeTab).toBe("import");
  });

  it("holds one modal entry while open and releases it when the tour closes", async () => {
    const screen = await render(<ShortcutsHarness />);
    await screen.getByTestId("start").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    expect(isAnyModalOpen()).toBe(true);

    driverCloseBtn()?.click();
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);
    expect(isAnyModalOpen()).toBe(false);
  });

  it("does not leak a modal entry when a tour restarts while one is running", async () => {
    const screen = await render(<ShortcutsHarness />);
    await screen.getByTestId("start").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    screen
      .getByTestId("start")
      .element()
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    expect(useModalStackStore.getState().count).toBe(1);

    driverCloseBtn()?.click();
    await expect.poll(() => document.querySelector(".driver-popover")).toBe(null);
    expect(useModalStackStore.getState().count).toBe(0);
  });

  it("releases the modal entry when a gate hands over to the guide card", async () => {
    const screen = await render(<TourHarness />);
    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 13");
    expect(useModalStackStore.getState().count).toBe(0);
  });

  it("releases the modal entry when the host unmounts mid tour", async () => {
    const screen = await render(<ShortcutsHarness />);
    await screen.getByTestId("start").click();
    await expect.poll(driverTitle).toBe("Welcome to Composer");
    await screen.unmount();
    expect(useModalStackStore.getState().count).toBe(0);
  });

  it("does not reopen the tour when the host unmounts while a passed gate is flashing Done", async () => {
    const screen = await render(<TourHarness />);
    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 13");
    setAudioLoaded();
    await expect.poll(() => screen.container.textContent).toContain("Done!");
    await screen.unmount();

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(useModalStackStore.getState().count).toBe(0);
    expect(document.querySelector(".driver-popover")).toBe(null);
  });
});

describe("resetTour", () => {
  it("forgets that the tour was seen and where it stopped", () => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex: 3, stepCount: 13 }));
    resetTour();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe(null);
    expect(localStorage.getItem(TOUR_RESUME_KEY)).toBe(null);
  });
});
