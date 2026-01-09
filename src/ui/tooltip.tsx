import { useCallback, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  delay?: number;
}

// -- Constants ----------------------------------------------------------------

const SHOW_DELAY = 300;

// -- Component ----------------------------------------------------------------

const Tooltip: React.FC<TooltipProps> = ({ content, children, side = "top", delay = SHOW_DELAY }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  const positionClasses =
    side === "top" ? "bottom-full left-1/2 -translate-x-1/2 mb-1.5" : "top-full left-1/2 -translate-x-1/2 mt-1.5";

  const arrowClasses =
    side === "top"
      ? "top-full left-1/2 -translate-x-1/2 border-t-composer-bg-dark border-x-transparent border-b-transparent"
      : "bottom-full left-1/2 -translate-x-1/2 border-b-composer-bg-dark border-x-transparent border-t-transparent";

  return (
    <span className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {isVisible && (
        <span
          className={`absolute w-max max-w-48 z-50 px-2 py-1.5 text-xs text-center leading-snug rounded bg-composer-bg-dark text-composer-text shadow-lg ${positionClasses}`}
          role="tooltip"
        >
          {content}
          <span className={`absolute w-0 h-0 border-4 ${arrowClasses}`} />
        </span>
      )}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { Tooltip };
