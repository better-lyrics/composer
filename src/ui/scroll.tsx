import { cn } from "@/utils/cn";
import "overlayscrollbars/overlayscrollbars.css";
import type { PartialOptions } from "overlayscrollbars";
import {
  OverlayScrollbarsComponent,
  type OverlayScrollbarsComponentRef,
  useOverlayScrollbars,
} from "overlayscrollbars-react";
import { type MutableRefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

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
  onScrollTopChange?: (scrollTop: number) => void;
  ignoreMutation?: (mutation: MutationRecord) => boolean;
}

interface ListScrollProps {
  children: React.ReactNode;
  className?: string;
  scrollParentRef: (scrollParent: HTMLDivElement | null) => void;
}

// -- Helpers ------------------------------------------------------------------

function scrollOptions(
  autoHide: AutoHide,
  autoHideDelay: number,
  ignoreMutation?: (mutation: MutationRecord) => boolean,
): PartialOptions {
  return {
    scrollbars: { theme: "os-theme-light", autoHide, autoHideDelay },
    ...(ignoreMutation && { update: { ignoreMutation } }),
  };
}

// -- Constants ----------------------------------------------------------------

const LIST_SCROLL_OPTIONS = scrollOptions("leave", 800);

// -- Components ---------------------------------------------------------------

const Scroll: React.FC<ScrollProps> = ({
  children,
  className,
  autoHide = "leave",
  autoHideDelay = 800,
  initialScrollTop,
  viewportRef,
  onInitialized,
  onScrollTopChange,
  ignoreMutation,
}) => {
  const componentRef = useRef<OverlayScrollbarsComponentRef>(null);
  const scrollTopRef = useRef(initialScrollTop);

  // OverlayScrollbars is deferred, so the host paints first; scrolling it now avoids a jump from the top.
  // A hidden Activity destroys the instance, so this also restores the position when the panel shows again.
  useLayoutEffect(() => {
    const host = componentRef.current?.getElement();
    if (host && scrollTopRef.current !== undefined) host.scrollTop = scrollTopRef.current;
  }, []);

  return (
    <OverlayScrollbarsComponent
      ref={componentRef}
      defer
      // Until OverlayScrollbars initializes (again after every hidden Activity shows), the host scrolls natively.
      className={cn("overflow-auto overscroll-none [scrollbar-width:none]", className)}
      options={scrollOptions(autoHide, autoHideDelay, ignoreMutation)}
      events={{
        initialized: (instance) => {
          const viewport = instance.elements().viewport as HTMLDivElement;
          if (viewportRef) viewportRef.current = viewport;
          onInitialized?.(viewport);
        },
        scroll: (instance) => {
          scrollTopRef.current = instance.elements().viewport.scrollTop;
          onScrollTopChange?.(scrollTopRef.current);
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

// A windowed list needs one element that scrolls in every state: before OverlayScrollbars initializes, while a
// hidden Activity has it destroyed, and after. Scroll moves scrolling between host and viewport; this keeps it on one.
const ListScroll: React.FC<ListScrollProps> = ({ children, className, scrollParentRef }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [initialize, instance] = useOverlayScrollbars({ defer: true, options: LIST_SCROLL_OPTIONS });

  useEffect(() => {
    const host = hostRef.current;
    const viewport = viewportRef.current;
    if (!host || !viewport) return;
    initialize({ target: host, elements: { viewport } });
    return () => instance()?.destroy();
  }, [initialize, instance]);

  const attachViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      scrollParentRef(element);
    },
    [scrollParentRef],
  );

  return (
    <div ref={hostRef} className={cn("overflow-hidden", className)}>
      <div
        ref={attachViewport}
        data-list-scroll-parent
        className="h-full overflow-y-auto overscroll-none [scrollbar-width:none]"
      >
        {children}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ListScroll, Scroll };
