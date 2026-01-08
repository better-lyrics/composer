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
};
