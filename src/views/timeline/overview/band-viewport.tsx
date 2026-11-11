import { useFrameLoop } from "@/hooks/use-frame-loop";
import { cn } from "@/utils/cn";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import { type ReactNode, useRef } from "react";
import { scrollContainerOf } from "@/views/timeline/scroll-container-of";
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
  const widthRef = useRef<number | null>(null);

  useFrameLoop(
    {
      read: () => {
        const container = scrollContainerOf(rootRef.current);
        widthRef.current = container ? Math.max(0, container.clientWidth - GUTTER_WIDTH) : null;
      },
      write: () => {
        const root = rootRef.current;
        const width = widthRef.current;
        if (!root || width === null) return;
        const written = writtenRef.current;
        const left = viewScrollLeft();
        if (written.left !== left) {
          written.left = left;
          root.style.transform = `translate3d(${left}px, 0, 0)`;
        }
        if (written.width !== width) {
          written.width = width;
          root.style.width = `${width}px`;
        }
      },
    },
    label,
  );

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
