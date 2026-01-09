import type { Transition, Variants } from "motion/react";

// -- Transitions --------------------------------------------------------------

const springSnappy: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
};

const springGentle: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const springBouncy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 15,
};

// -- Reduced Motion Variants --------------------------------------------------

const reducedMotionTransition: Transition = {
  duration: 0,
};

// -- Fade Variants ------------------------------------------------------------

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// -- Scale Variants -----------------------------------------------------------

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const scaleTapVariants: Variants = {
  tap: { scale: 0.97 },
};

// -- Slide Variants -----------------------------------------------------------

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// -- Sync Carousel (vertical, direction-aware, instant) ----------------------

const syncCarouselTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

const syncLineVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const syncContextVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 0.4,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? -30 : 30,
    opacity: 0,
  }),
};

const syncPulseVariants: Variants = {
  idle: {
    boxShadow: "0 0 0px rgba(129, 140, 248, 0)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  pulse: {
    boxShadow: "0 0 16px rgba(129, 140, 248, 0.4)",
    borderColor: "rgba(129, 140, 248, 0.5)",
  },
};

const shimmerTransition: Transition = {
  type: "spring",
  stiffness: 30,
  damping: 15,
};

const shimmerVariants: Variants = {
  initial: { backgroundPosition: "200% 0" },
  animate: { backgroundPosition: "-100% 0" },
};

// -- Stagger Container --------------------------------------------------------

const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
};

// -- Exports ------------------------------------------------------------------

export {
  springSnappy,
  springGentle,
  springBouncy,
  reducedMotionTransition,
  fadeVariants,
  scaleVariants,
  scaleTapVariants,
  slideUpVariants,
  slideDownVariants,
  staggerContainerVariants,
  staggerItemVariants,
  syncCarouselTransition,
  syncLineVariants,
  syncContextVariants,
  syncPulseVariants,
  shimmerTransition,
  shimmerVariants,
};
