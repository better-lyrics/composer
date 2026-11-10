import { memo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface FreezeWhileHiddenProps {
  hidden: boolean;
  children: React.ReactNode;
}

// -- Components ---------------------------------------------------------------

// A hidden tab keeps its last output: playback ticks and play or pause would otherwise mount views nobody sees.
const FreezeWhileHidden = memo<FreezeWhileHiddenProps>(
  ({ children }) => children,
  (_previous, next) => next.hidden,
);

// -- Exports ------------------------------------------------------------------

export { FreezeWhileHidden };
