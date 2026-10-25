import { useFrameLoop } from "@/hooks/use-frame-loop";
import { cn } from "@/utils/cn";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import { type ReactNode, useRef } from "react";

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

  useFrameLoop(() => {
    const root = rootRef.current;
    const container = root?.closest<HTMLElement>("[data-scroll-container]");
    if (!root || !container) return;
    const transform = `translate3d(${container.scrollLeft}px, 0, 0)`;
    if (root.style.transform !== transform) root.style.transform = transform;
    const width = `${Math.max(0, container.clientWidth - GUTTER_WIDTH)}px`;
    if (root.style.width !== width) root.style.width = width;
  }, label);

  return (
    <div ref={rootRef} className={cn("absolute inset-y-0 left-0 pointer-events-none", className)}>
      {children}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { BandViewport };
