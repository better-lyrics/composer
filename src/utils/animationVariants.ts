import { hexToRgba } from "@/utils/colors";
import type { Transition, Variants } from "motion/react";

// -- Transitions --------------------------------------------------------------

const springSnappy: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
};

// -- Reduced Motion Variants --------------------------------------------------

// -- Fade Variants ------------------------------------------------------------

// -- Scale Variants -----------------------------------------------------------

// -- Slide Variants -----------------------------------------------------------

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

// The x holds the centring a `left-1/2` element would take from `-translate-x-1/2`, which motion
// overwrites the moment it owns the transform.
const centeredSlideUpVariants: Variants = {
  hidden: { opacity: 0, x: "-50%", y: 8 },
  visible: { opacity: 1, x: "-50%", y: 0 },
  exit: { opacity: 0, x: "-50%", y: 8 },
};

const centeredFadeVariants: Variants = {
  hidden: { opacity: 0, x: "-50%" },
  visible: { opacity: 1, x: "-50%" },
  exit: { opacity: 0, x: "-50%" },
};

// A tab's inline status icon grows in from nothing, so the label beside it slides instead of jumping.
// The -6px margin cancels the parent's gap while the icon has no width.
const inlineIconTransition: Transition = { type: "spring", duration: 0.3, bounce: 0 };

const inlineIconVariants: Variants = {
  hidden: { opacity: 0, scale: 0.25, filter: "blur(4px)", width: 0, marginLeft: -6 },
  visible: { opacity: 1, scale: 1, filter: "blur(0px)", width: "auto", marginLeft: -2 },
  exit: { opacity: 0, scale: 0.25, filter: "blur(4px)", width: 0, marginLeft: -6 },
};

const inlineIconReducedVariants: Variants = {
  hidden: { opacity: 0, width: 0, marginLeft: -6 },
  visible: { opacity: 1, width: "auto", marginLeft: -2 },
  exit: { opacity: 0, width: 0, marginLeft: -6 },
};

// -- Sync Tap Ring -------------------------------------------------------------

const syncTapRingVariants: Variants = {
  initial: { scale: 0.8, opacity: 0.5 },
  animate: { scale: 2.2, opacity: 0 },
};

const syncTapRingTransition: Transition = { duration: 0.33, ease: "easeOut" };

function buildGroupPingVariants(color: string): Variants {
  const transparent = hexToRgba(color, 0);
  const visible = hexToRgba(color, 0.55);
  return {
    idle: {
      boxShadow: `0 0 0 0 ${transparent}`,
      transition: { duration: 0 },
    },
    ping: {
      boxShadow: [`0 0 0 0 ${visible}`, `0 0 0 8px ${transparent}`],
      transition: { type: "spring", stiffness: 120, damping: 20, mass: 0.6 },
    },
  };
}

const shimmerTransition: Transition = {
  type: "spring",
  stiffness: 30,
  damping: 15,
};

const shimmerVariants: Variants = {
  initial: { backgroundPosition: "200% 0" },
  animate: { backgroundPosition: "-100% 0" },
};

// -- Snap Markers -------------------------------------------------------------

const pinDropInVariants: Variants = {
  initial: { opacity: 0, y: -8, scale: 0.6 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 600, damping: 20, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.6,
    transition: { type: "spring", stiffness: 500, damping: 28, mass: 0.7 },
  },
};

const snapFlashVariants: Variants = {
  initial: { opacity: 0, "--flash-glow": "0px" },
  animate: {
    opacity: [0.9, 0],
    "--flash-glow": ["18px", "0px"],
    transition: { type: "spring", stiffness: 120, damping: 22, mass: 0.7 },
  },
};

// -- Floating Entrance --------------------------------------------------------

// Popovers and menus grow out of their trigger and leave toward it; floating-ui runs both as CSS transitions.
const floatingEntrance = {
  openMs: 200,
  closeMs: 150,
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  initial: { opacity: 0, scale: "0.97", filter: "blur(4px)" },
  close: { opacity: 0, filter: "blur(4px)", transitionTimingFunction: "ease-in" },
  closeShiftPx: 12,
  reducedInitial: { opacity: 0 },
} as const;

// -- Pitch Line ---------------------------------------------------------------

// Canvas layers in the Timeline rows animate through the Web Animations API, so these are plain numbers.
const pitchLineMotion = {
  spillFadeMs: 150,
  wipeMs: 560,
  wipeEase: [0.45, 0, 0.25, 1],
  rowLeadMs: 60,
  rowStaggerMs: 80,
  riseMs: 240,
  labelLeadPx: 6,
  reducedFadeMs: 150,
  fadeEase: "ease-out",
} as const;

const pitchLineKeyframes: Record<"wipe" | "reducedWipe" | "fadeOut", Keyframe[]> = {
  wipe: [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
  reducedWipe: [{ opacity: 0 }, { opacity: 1 }],
  fadeOut: [{ opacity: 1 }, { opacity: 0 }],
};

// -- Spectrum Zoom ------------------------------------------------------------

const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3;

// Sharp tiles fade in over the stretched band on a canvas, so these are plain numbers and a curve.
const spectrumRefineMotion = {
  fadeMs: 120,
  reducedFadeMs: 80,
  ease: easeOutCubic,
} as const;

// -- Edit Loupe ---------------------------------------------------------------

const loupeEnterTransition: Transition = { type: "spring", duration: 0.18, bounce: 0 };
const loupeExitTransition: Transition = { type: "spring", duration: 0.12, bounce: 0 };

const loupeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
  visible: { opacity: 1, scale: 1, filter: "blur(0px)", transition: loupeEnterTransition },
  exit: { opacity: 0, scale: 0.96, filter: "blur(4px)", transition: loupeExitTransition },
};

const loupeReducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: loupeEnterTransition },
  exit: { opacity: 0, transition: loupeExitTransition },
};

// Keyframes need a tween; a spring cannot run a three-step scale.
const loupeDeltaPopVariants: Variants = {
  rest: { scale: 1 },
  pop: { scale: [1, 1.12, 1], transition: { duration: 0.16, ease: "easeOut" } },
};

// -- Stagger Container --------------------------------------------------------

// -- Guide --------------------------------------------------------------------

// Fluid by default: every guide state change is a zero-bounce spring that retargets mid-flight.
const guideSpring: Transition = { type: "spring", duration: 0.25, bounce: 0 };
const guideSpringSlow: Transition = { type: "spring", duration: 0.5, bounce: 0 };

const guideCardVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97, filter: "blur(4px)" },
  shown: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { ...guideSpring, staggerChildren: 0.04 } },
  exit: { opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.15, ease: "easeOut" } },
};

const guideChunkVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: guideSpring },
};

const guideIconSwapVariants: Variants = {
  hidden: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  shown: { opacity: 1, scale: 1, filter: "blur(0px)", transition: guideSpring },
};

const guidePeekTextVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(4px)" },
  shown: { opacity: 1, filter: "blur(0px)", transition: { ...guideSpring, delay: 0.08 } },
  exit: { opacity: 0, filter: "blur(4px)", transition: { duration: 0.1 } },
};

const guideBadgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  shown: { opacity: 1, scale: 1, transition: guideSpring },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.1 } },
};

// Card views swap in place: blur bridges the two states while the body springs to the new height.
const guideViewSwapVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(2px)" },
  shown: { opacity: 1, filter: "blur(0px)", transition: guideSpring },
  exit: { opacity: 0, filter: "blur(2px)", transition: { duration: 0.12, ease: "easeOut" } },
};

// A row leaves in place while the rows below and the card spring into the gap.
const guideRowExit = { opacity: 0, filter: "blur(2px)", transition: { duration: 0.12, ease: "easeOut" } } as const;

const guideChipVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  shown: { opacity: 1, y: 0, transition: guideSpring },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// Delight is saved for milestones: the medal drops in, then the copy rises in after it lands.
const guideMedalDropVariants: Variants = {
  hidden: { opacity: 0, y: -18, scale: 0.9 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { ...guideSpringSlow, delay: 0.1 } },
};

const guideRevealVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  shown: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...guideSpringSlow, delay: 0.55 + index * 0.1 },
  }),
};

const guideMedalPress = { downAtMs: 420, upAtMs: 560, sweepStepMs: 50, sweepStartMs: 150 } as const;

// -- Exports ------------------------------------------------------------------

export {
  springSnappy,
  slideUpVariants,
  centeredSlideUpVariants,
  centeredFadeVariants,
  syncTapRingTransition,
  syncTapRingVariants,
  buildGroupPingVariants,
  shimmerTransition,
  shimmerVariants,
  pinDropInVariants,
  snapFlashVariants,
  floatingEntrance,
  loupeDeltaPopVariants,
  loupeReducedVariants,
  loupeVariants,
  inlineIconTransition,
  inlineIconVariants,
  inlineIconReducedVariants,
  pitchLineKeyframes,
  pitchLineMotion,
  spectrumRefineMotion,
  easeOutCubic,
  guideSpring,
  guideCardVariants,
  guideChunkVariants,
  guideIconSwapVariants,
  guidePeekTextVariants,
  guideBadgeVariants,
  guideRowExit,
  guideViewSwapVariants,
  guideChipVariants,
  guideMedalDropVariants,
  guideRevealVariants,
  guideMedalPress,
};
