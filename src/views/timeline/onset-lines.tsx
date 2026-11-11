import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useWindowSize } from "@/hooks/use-window-size";
import { onsetIndicesInView, onsetWindowStep } from "@/views/timeline/snap-marker-math";
import { viewScrollLeft } from "@/views/timeline/view-scroll";
import { memo, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface OnsetLinesProps {
  onsets: number[];
  coveredOnsets: Set<number>;
  zoom: number;
  bandHeight: number;
}

interface OnsetLineProps {
  time: number;
  index: number;
  zoom: number;
  bandHeight: number;
  covered: boolean;
  revealedAt: number;
}

interface Reveal {
  onsets: number[];
  at: number;
}

// -- Constants -----------------------------------------------------------------

const ONSET_STAGGER_STEP_MS = 24;
const ONSET_STAGGER_CAP_MS = 900;

// -- Components ----------------------------------------------------------------

// Fixed at mount, so a line scrolled into view joins the reveal stagger where it stands instead of replaying it.
const OnsetLine = memo<OnsetLineProps>(({ time, index, zoom, bandHeight, covered, revealedAt }) => {
  const [animationDelay] = useState(
    () => `${Math.min(index * ONSET_STAGGER_STEP_MS, ONSET_STAGGER_CAP_MS) - (performance.now() - revealedAt)}ms`,
  );
  return (
    <div
      data-snap-marker="onset"
      data-covered={covered ? "" : undefined}
      className={`snap-onset-line snap-onset-enter absolute top-0 -translate-x-1/2 pointer-events-none ${
        covered ? "snap-onset-covered" : ""
      }`}
      style={{ left: time * zoom, height: bandHeight, animationDelay }}
    />
  );
});

const OnsetLines: React.FC<OnsetLinesProps> = ({ onsets, coveredOnsets, zoom, bandHeight }) => {
  const [followedStep, setFollowedStep] = useState(() => onsetWindowStep(viewScrollLeft()));
  useFrameLoop(() => setFollowedStep(onsetWindowStep(viewScrollLeft())), "onset-lines-window");
  const viewportWidth = useWindowSize().width;
  const [reveal, setReveal] = useState<Reveal>(() => ({ onsets, at: performance.now() }));
  if (reveal.onsets !== onsets) setReveal({ onsets, at: performance.now() });

  const indices = onsetIndicesInView(onsets, zoom, followedStep, onsetWindowStep(viewScrollLeft()), viewportWidth);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {indices.map((index) => (
        <OnsetLine
          key={`${onsets[index]}-${index}`}
          time={onsets[index]}
          index={index}
          zoom={zoom}
          bandHeight={bandHeight}
          covered={coveredOnsets.has(index)}
          revealedAt={reveal.at}
        />
      ))}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { OnsetLines };
