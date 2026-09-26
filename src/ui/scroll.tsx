import { cn } from "@/utils/cn";
import "overlayscrollbars/overlayscrollbars.css";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { MutableRefObject } from "react";

// -- Types --------------------------------------------------------------------

type AutoHide = "scroll" | "leave" | "move" | "never";

interface ScrollProps {
  children: React.ReactNode;
  className?: string;
  autoHide?: AutoHide;
  autoHideDelay?: number;
  viewportRef?: MutableRefObject<HTMLDivElement | null>;
  onInitialized?: (viewport: HTMLDivElement) => void;
}

// -- Component ----------------------------------------------------------------

const Scroll: React.FC<ScrollProps> = ({
  children,
  className,
  autoHide = "leave",
  autoHideDelay = 800,
  viewportRef,
  onInitialized,
}) => (
  <OverlayScrollbarsComponent
    defer
    className={cn("overflow-auto", className)}
    options={{
      scrollbars: { theme: "os-theme-light", autoHide, autoHideDelay },
    }}
    events={{
      initialized: (instance) => {
        const viewport = instance.elements().viewport as HTMLDivElement;
        if (viewportRef) viewportRef.current = viewport;
        onInitialized?.(viewport);
      },
      destroyed: () => {
        if (viewportRef) viewportRef.current = null;
      },
    }}
  >
    {children}
  </OverlayScrollbarsComponent>
);

// -- Exports ------------------------------------------------------------------

export { Scroll };
