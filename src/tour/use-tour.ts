import { BEST_PRACTICES_STEP_TITLE, type GatedStep, TOUR_GATED_STEPS, createTourSteps } from "@/tour/tour-steps";
import type { GuideCardState } from "@/tour/guide-card";
import { driver, type Driver, type DriveStep, type PopoverDOM } from "driver.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

// -- Constants ----------------------------------------------------------------

const TOUR_SEEN_KEY = "composer-tour-seen";
const TOUR_RESUME_KEY = "composer-tour-resume:v1";
const LOG_PREFIX = "[Tour]";
const VIDEO_BUTTON_CLASS = "composer-tour-video-btn";
const GATE_CHECK_INTERVAL = 300;
const GATE_SUCCESS_DELAY = 800;

// -- Resume state persistence -------------------------------------------------

function saveResumeState(stepIndex: number, stepCount: number) {
  localStorage.setItem(TOUR_RESUME_KEY, JSON.stringify({ stepIndex, stepCount }));
}

// A stored index only means anything against the step list it was written for. Inserting or removing a
// step silently repoints it, so a payload whose count no longer matches is discarded rather than resumed.
function loadResumeState(stepCount: number): { stepIndex: number } | null {
  const raw = localStorage.getItem(TOUR_RESUME_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { stepIndex?: unknown; stepCount?: unknown };
    if (parsed.stepCount !== stepCount || typeof parsed.stepIndex !== "number") return null;
    return { stepIndex: parsed.stepIndex };
  } catch (error) {
    console.warn(LOG_PREFIX, "discarding unreadable tour resume state", error);
    return null;
  }
}

function clearResumeState() {
  localStorage.removeItem(TOUR_RESUME_KEY);
}

// -- Watch the closing walkthrough --------------------------------------------

// The conventions step overrides its next button to hand off to the help modal, which ends the tour,
// so without this the closing video step is unreachable. driver.js has no third footer button, so it
// gets injected, and tour-theme.css styles it alongside the Back button.
function injectWatchVideo(popover: PopoverDOM, activeStep: DriveStep | undefined, tourDriver: Driver) {
  if (activeStep?.popover?.title !== BEST_PRACTICES_STEP_TITLE) return;
  if (popover.footerButtons.querySelector(`.${VIDEO_BUTTON_CLASS}`)) return;

  // Not driver-popover-prev-btn: driver delegates clicks with closest(".driver-popover-prev-btn"),
  // so borrowing that class for styling would make this button walk backwards.
  const watch = document.createElement("button");
  watch.type = "button";
  watch.className = VIDEO_BUTTON_CLASS;
  watch.textContent = "Watch the video";
  watch.addEventListener("click", () => tourDriver.moveNext());
  popover.footerButtons.insertBefore(watch, popover.nextButton);
}

// -- Types --------------------------------------------------------------------

interface UseTourOptions {
  onOpenBestPractices: () => void;
}

// -- Hook ---------------------------------------------------------------------

function useTour({ onOpenBestPractices }: UseTourOptions) {
  const driverRef = useRef<Driver | null>(null);
  const gateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [guideCard, setGuideCard] = useState<GuideCardState | null>(null);
  const reducedMotion = useReducedMotion();

  const shouldShowTour = !localStorage.getItem(TOUR_SEEN_KEY);

  const markTourSeen = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
  }, []);

  const clearGateInterval = useCallback(() => {
    if (gateIntervalRef.current) {
      clearInterval(gateIntervalRef.current);
      gateIntervalRef.current = null;
    }
  }, []);

  const destroyDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  const openBestPractices = useCallback(() => {
    destroyDriver();
    onOpenBestPractices();
  }, [destroyDriver, onOpenBestPractices]);

  const createDriverInstance = useCallback(
    (steps: DriveStep[], onStepChange?: (index: number) => void) => {
      return driver({
        steps,
        popoverClass: "composer-tour",
        overlayColor: "#000",
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 8,
        animate: !reducedMotion,
        smoothScroll: false,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        allowClose: true,
        onPopoverRender: (popover, opts) => injectWatchVideo(popover, opts.state.activeStep, opts.driver),
        onHighlighted: (_el, _step, opts) => {
          const idx = opts.state.activeIndex;
          if (idx !== undefined) {
            onStepChange?.(idx);
          }
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });
    },
    [reducedMotion],
  );

  const startGuideCard = useCallback(
    (gatedStep: GatedStep, totalSteps: number, patchedSteps: DriveStep[]) => {
      clearGateInterval();

      const nextStepIndex = gatedStep.stepIndex + 1;
      const stepLabel = `Step ${gatedStep.stepIndex + 1} / ${totalSteps}`;

      setGuideCard({ task: gatedStep.task, stepLabel, stepIndex: gatedStep.stepIndex, isComplete: false });
      saveResumeState(gatedStep.stepIndex, totalSteps);

      gateIntervalRef.current = setInterval(() => {
        if (gatedStep.gateCheck()) {
          clearGateInterval();
          setGuideCard((prev) => (prev ? { ...prev, isComplete: true } : null));

          setTimeout(() => {
            setGuideCard(null);
            const d = createDriverInstance(patchedSteps, (idx) => saveResumeState(idx, patchedSteps.length));
            driverRef.current = d;
            d.drive(nextStepIndex);
          }, GATE_SUCCESS_DELAY);
        }
      }, GATE_CHECK_INTERVAL);
    },
    [clearGateInterval, createDriverInstance],
  );

  const patchStepsWithGates = useCallback(
    (steps: DriveStep[]): DriveStep[] => {
      const gatedIndices = new Map(TOUR_GATED_STEPS.map((g) => [g.stepIndex, g]));

      const patched: DriveStep[] = steps.map((step, idx) => {
        const gatedStep = gatedIndices.get(idx);
        if (!gatedStep) return step;

        return {
          ...step,
          onHighlighted: (_el: Element | undefined, _step: DriveStep, opts: { state: { activeIndex?: number } }) => {
            // If going backwards (user clicked Back), don't gate - just let it show
            const activeIdx = opts.state.activeIndex ?? idx;
            if (activeIdx < idx) return;

            if (gatedStep.gateCheck()) {
              setTimeout(() => {
                driverRef.current?.moveNext();
              }, 100);
              return;
            }

            destroyDriver();
            startGuideCard(gatedStep, steps.length, patched);
          },
        };
      });

      return patched;
    },
    [destroyDriver, startGuideCard],
  );

  const skipGuideCard = useCallback(() => {
    clearGateInterval();
    const currentIdx = guideCard?.stepIndex;
    setGuideCard(null);
    if (currentIdx === undefined) return;

    const steps = createTourSteps(openBestPractices);
    const gatedIndices = new Set(TOUR_GATED_STEPS.map((g) => g.stepIndex));
    let nextIdx = currentIdx + 1;
    while (nextIdx < steps.length && gatedIndices.has(nextIdx)) {
      nextIdx++;
    }

    if (nextIdx < steps.length) {
      const patchedSteps = patchStepsWithGates(steps);
      const d = createDriverInstance(patchedSteps, (idx) => saveResumeState(idx, patchedSteps.length));
      driverRef.current = d;
      d.drive(nextIdx);
    }
  }, [guideCard, clearGateInterval, createDriverInstance, patchStepsWithGates, openBestPractices]);

  const driveTour = useCallback(
    (startIndex?: number) => {
      destroyDriver();
      clearGateInterval();
      setGuideCard(null);

      const steps = createTourSteps(openBestPractices);
      const patchedSteps = patchStepsWithGates(steps);

      const d = createDriverInstance(patchedSteps, (idx) => saveResumeState(idx, patchedSteps.length));
      driverRef.current = d;
      d.drive(startIndex ?? 0);
    },
    [destroyDriver, clearGateInterval, createDriverInstance, patchStepsWithGates, openBestPractices],
  );

  const startTour = useCallback(() => {
    markTourSeen();
    clearResumeState();
    driveTour();
  }, [markTourSeen, driveTour]);

  useEffect(() => {
    return () => {
      destroyDriver();
      clearGateInterval();
    };
  }, [destroyDriver, clearGateInterval]);

  const resumeOrStartTour = useCallback(() => {
    const isActive = driverRef.current?.isActive() || guideCard !== null;
    if (isActive) {
      destroyDriver();
      clearGateInterval();
      setGuideCard(null);
      return;
    }

    const resume = loadResumeState(createTourSteps(openBestPractices).length);
    if (resume) {
      markTourSeen();
      driveTour(resume.stepIndex);
    } else {
      startTour();
    }
  }, [guideCard, destroyDriver, clearGateInterval, markTourSeen, driveTour, startTour, openBestPractices]);

  return {
    startTour,
    resumeOrStartTour,
    shouldShowTour,
    guideCard,
    skipGuideCard,
  };
}

// -- Exports ------------------------------------------------------------------

export { TOUR_RESUME_KEY, TOUR_SEEN_KEY, useTour };
