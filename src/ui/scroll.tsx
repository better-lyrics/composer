import { cn } from "@/utils/cn";
import "overlayscrollbars/overlayscrollbars.css";
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { type MutableRefObject, useLayoutEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

type AutoHide = "scroll" | "leave" | "move" | "never";

interface ScrollProps {
  children: React.ReactNode;
  className?: string;
  autoHide?: AutoHide;
  autoHideDelay?: number;
  initialScrollTop?: number;
  viewportRef?: MutableRefObject<HTMLDivElement | null>;
  onInitialized?: (viewport: HTMLDivElement) => void;
}

// -- Component ----------------------------------------------------------------

const Scroll: React.FC<ScrollProps> = ({
  children,
  className,
  autoHide = "leave",
  autoHideDelay = 800,
  initialScrollTop,
  viewportRef,
  onInitialized,
}) => {
  const componentRef = useRef<OverlayScrollbarsComponentRef>(null);
  const initialScrollTopRef = useRef(initialScrollTop);

  // OverlayScrollbars is deferred, so the host paints first; scrolling it now avoids a jump from the top.
  useLayoutEffect(() => {
    const host = componentRef.current?.getElement();
    if (host && initialScrollTopRef.current !== undefined) host.scrollTop = initialScrollTopRef.current;
  }, []);

  return (
    <OverlayScrollbarsComponent
      ref={componentRef}
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
};

// -- Exports ------------------------------------------------------------------

export { Scroll };
