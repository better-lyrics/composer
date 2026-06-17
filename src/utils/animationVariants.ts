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

// -- Sync Carousel (vertical, direction-aware, instant) ----------------------

const syncCarouselTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

const syncPulseVariants: Variants = {
  idle: {
    boxShadow: "0 0 0px rgba(129, 140, 248, 0)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
  pulse: {
    boxShadow: "0 0 16px rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    transition: { duration: 0 },
  },
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
  initial: { opacity: 0, boxShadow: "0 0 0px rgba(255, 255, 255, 0)" },
  animate: {
    opacity: [0.9, 0],
    boxShadow: ["0 0 18px rgba(255, 255, 255, 0.9)", "0 0 0px rgba(255, 255, 255, 0)"],
    transition: { type: "spring", stiffness: 120, damping: 22, mass: 0.7 },
  },
};

// -- Stagger Container --------------------------------------------------------

// -- Exports ------------------------------------------------------------------

export {
  springSnappy,
  slideUpVariants,
  syncCarouselTransition,
  syncPulseVariants,
  buildGroupPingVariants,
  shimmerTransition,
  shimmerVariants,
  pinDropInVariants,
  snapFlashVariants,
};
