import { beforeEach, describe, expect, it } from "vitest";
import { GuideCard } from "@/tour/guide-card";
import { useTour } from "@/tour/use-tour";
import { render } from "@/test/render";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

// -- Harness ------------------------------------------------------------------

function TourHarness() {
  const { startTour, guideCard, skipGuideCard } = useTour();
  return (
    <div>
      <button type="button" data-testid="start" onClick={() => startTour()}>
        Start
      </button>
      <GuideCard state={guideCard} onSkip={skipGuideCard} />
    </div>
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

// -- Tests --------------------------------------------------------------------

describe("useTour skipGuideCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("advances from the lyrics guide card to the Sync step even when the audio gate is also failing", async () => {
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await expect.poll(driverProgress).toBe("1 / 11");
    await clickNext();
    await expect.poll(driverProgress).toBe("2 / 11");
    await clickNext();
    // Audio gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 11");

    // Skip audio guide -> step 3 Edit "Type or paste lyrics" (4/11).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 11");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");

    // Step 3 -> step 4 gated lyrics -> guide card.
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 11");

    // BUG: skip jumps back to step 3 (4/11) because the skip logic re-scans gates
    // and picks the first failing one (audio), not the one the user is currently on.
    // FIX: skip advances to step 5 Sync (6/11).
    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 11");
    await expect.poll(driverTitle).toBe("Sync your lyrics");
  });

  it("skipping the audio guide card lands on the Edit step", async () => {
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 3 / 11");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("4 / 11");
    await expect.poll(driverTitle).toBe("Type or paste lyrics");
  });

  it("skipping the lyrics guide card with audio loaded lands on the Sync step", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    // Audio gate passes -> driver auto-advances past step 2 to step 3 (Edit, 4/11).
    await expect.poll(driverProgress).toBe("4 / 11");

    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 11");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("6 / 11");
    await expect.poll(driverTitle).toBe("Sync your lyrics");
  });

  it("skipping the sync guide card lands on the Timeline step", async () => {
    setAudioLoaded();
    setLyrics();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 11");
    await clickNext();
    // Lyrics gate passes -> auto-advance to step 5 Sync (6/11).
    await expect.poll(driverProgress).toBe("6 / 11");
    await clickNext();
    // Sync gate fails -> guide card replaces the popover.
    await expect.poll(() => screen.container.textContent).toContain("Step 7 / 11");

    await screen.getByRole("button", { name: "Skip" }).click();
    await expect.poll(driverProgress).toBe("8 / 11");
    await expect.poll(driverTitle).toBe("Fine-tune on the timeline");
  });

  it("transitions from the lyrics guide card to the Sync step when lyrics get added", async () => {
    setAudioLoaded();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 11");
    await clickNext();
    await expect.poll(() => screen.container.textContent).toContain("Step 5 / 11");

    // Populate lyrics. The gate poll detects the pass, flashes "Done!", then advances.
    setLyrics();

    await expect.poll(() => screen.container.textContent).toContain("Done!");
    // The advance is intentionally delayed by GATE_SUCCESS_DELAY (800ms) after "Done!",
    // so this needs more than the default 1000ms poll budget under load.
    await expect.poll(driverProgress, { timeout: 4000 }).toBe("6 / 11");
  });

  it("does not show the sync guide card when the sync gate already passes", async () => {
    setAudioLoaded();
    setLyricsSynced();
    const screen = await render(<TourHarness />);

    await screen.getByTestId("start").click();
    await clickNext();
    await clickNext();
    await expect.poll(driverProgress).toBe("4 / 11");
    await clickNext();
    await expect.poll(driverProgress).toBe("6 / 11");
    await clickNext();
    // Sync gate passes -> driver auto-advances past step 6. Guide card never appears.
    await expect.poll(() => screen.container.textContent?.includes("Step 7 / 11") ?? false).toBe(false);
  });
});
