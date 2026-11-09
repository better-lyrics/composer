import { domMax } from "motion/react";

// -- Constants ----------------------------------------------------------------

// Layout animations live only in domMax; the Guide loads it in its own chunk so the app keeps domAnimation.
const guideMotionFeatures = domMax;

// -- Exports ------------------------------------------------------------------

export { guideMotionFeatures };
