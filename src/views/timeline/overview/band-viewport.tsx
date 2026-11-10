import { useFrameLoop } from "@/hooks/use-frame-loop";
import { cn } from "@/utils/cn";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import { type ReactNode, useRef } from "react";
import { viewScrollLeft } from "@/views/timeline/view-scroll";

// -- Interfaces ----------------------------------------------------------------

interface BandViewportProps {
  label: string;
  className?: string;
  children: ReactNode;
}

// -- Components ----------------------------------------------------------------

// The band is as wide as the song; this layer stays over the visible part of it.
const BandViewport: React.FC<BandViewportProps> = ({ label, className, children }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const writtenRef = useRef({ left: Number.NaN, width: Number.NaN });

  useFrameLoop(() => {
    const root = rootRef.current;
    const container = root?.closest<HTMLElement>("[data-scroll-container]");
    if (!root || !container) return;
    const written = writtenRef.current;
    const left = viewScrollLeft();
    if (written.left !== left) {
      written.left = left;
      root.style.transform = `translate3d(${left}px, 0, 0)`;
    }
    const width = Math.max(0, container.clientWidth - GUTTER_WIDTH);
    if (written.width !== width) {
      written.width = width;
      root.style.width = `${width}px`;
    }
  }, label);

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      <div ref={rootRef} data-playback-style="transform" className="absolute inset-y-0 left-0">
        {children}
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BandViewport };
