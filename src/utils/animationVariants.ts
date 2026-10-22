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

// -- Sync Carousel (vertical, direction-aware, instant) ----------------------

const syncCarouselTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

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

const snapFlashVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: [0.9, 0],
    transition: { type: "spring", stiffness: 120, damping: 22, mass: 0.7 },
  },
};

// -- Floating Entrance --------------------------------------------------------

// Popovers and menus grow out of their trigger; floating-ui runs it as a CSS transition.
const floatingEntrance = {
  durationMs: 150,
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  initial: { opacity: 0, scale: "0.97" },
  reducedInitial: { opacity: 0 },
} as const;

// -- Stagger Container --------------------------------------------------------

// -- Exports ------------------------------------------------------------------

export {
  springSnappy,
  slideUpVariants,
  centeredSlideUpVariants,
  centeredFadeVariants,
  syncCarouselTransition,
  buildGroupPingVariants,
  shimmerTransition,
  shimmerVariants,
  snapFlashVariants,
  floatingEntrance,
};
