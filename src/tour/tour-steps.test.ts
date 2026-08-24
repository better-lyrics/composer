import { type DriveStep, driver } from "driver.js";
import { describe, expect, it } from "vitest";
import { BEST_PRACTICES_STEP_TITLE, TOUR_GATED_STEPS, createTourSteps } from "@/tour/tour-steps";

// -- Helpers ------------------------------------------------------------------

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
    expect(steps[videoIndex - 1]?.popover?.title).toBe(BEST_PRACTICES_STEP_TITLE);
  });

  it("puts the closing video last, so best practices is second to last", () => {
    const steps = createTourSteps(() => {});
    expect(steps[steps.length - 2]?.popover?.title).toBe(BEST_PRACTICES_STEP_TITLE);
    expect(steps[steps.length - 1]?.popover?.description).toContain("composer-tour-video-embed");
  });

  it("invokes the callback when the best practices step is actioned", () => {
    let opened = false;
    const steps = createTourSteps(() => {
      opened = true;
    });
    const step = findByTitle(steps, BEST_PRACTICES_STEP_TITLE);
    expect(step).toBeDefined();
    if (step) clickNextOn(step, steps);
    expect(opened).toBe(true);
  });

  it("binds the callback given to the call that built the steps", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const firstSteps = createTourSteps(() => firstCalls++);
    const secondSteps = createTourSteps(() => secondCalls++);

    const secondStep = findByTitle(secondSteps, BEST_PRACTICES_STEP_TITLE);
    if (secondStep) clickNextOn(secondStep, secondSteps);

    expect(secondCalls).toBe(1);
    expect(firstCalls).toBe(0);
    expect(findByTitle(firstSteps, BEST_PRACTICES_STEP_TITLE)).not.toBe(secondStep);
  });

  it("labels the best practices action Read them and keeps the back and close buttons", () => {
    const step = findByTitle(
      createTourSteps(() => {}),
      BEST_PRACTICES_STEP_TITLE,
    );
    expect(step?.popover?.nextBtnText).toBe("Read them");
    expect(step?.popover?.showButtons).toEqual(["previous", "next", "close"]);
  });

  it("anchors the best practices step to no element, so it reads as a modal", () => {
    const step = findByTitle(
      createTourSteps(() => {}),
      BEST_PRACTICES_STEP_TITLE,
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
    const bestPracticesIndex = steps.findIndex((s) => s.popover?.title === BEST_PRACTICES_STEP_TITLE);
    for (const gate of TOUR_GATED_STEPS) expect(gate.stepIndex).toBeLessThan(bestPracticesIndex);
  });

  it("gives each of its twelve steps a popover with a title", () => {
    const steps = createTourSteps(() => {});
    expect(steps).toHaveLength(12);
    for (const step of steps) expect(step.popover?.title?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
