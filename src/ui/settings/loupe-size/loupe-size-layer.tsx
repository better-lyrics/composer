import {
  LOUPE_FIXED,
  LOUPE_SIZE,
  type LoupeSize,
  clampLoupeSize,
  fitLoupeSize,
  isDefaultLoupeSize,
  resizedLoupe,
} from "@/domain/spectrum/loupe-size";
import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { livePlaybackTime } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { SettingLink } from "@/ui/setting-link";
import { LoupeSizeHandles } from "@/ui/settings/loupe-size/loupe-size-handles";
import { previewLoupeTarget } from "@/ui/settings/loupe-size/preview-target";
import { cn } from "@/utils/cn";
import { loupeCanvas } from "@/views/timeline/loupe/draw-loupe";
import { LOUPE_CARD_SURFACE, LoupeCardBody } from "@/views/timeline/loupe/loupe-card-body";
import { useSpectrumStatus } from "@/views/timeline/spectrum/spectrum-session";
import { FloatingFocusManager, FloatingPortal, useFloating } from "@floating-ui/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface LoupeSizeLayerProps {
  open: boolean;
  onClose: () => void;
}

interface LoupeSizeStageProps {
  onClose: () => void;
}

// -- Constants ----------------------------------------------------------------

const STEP = LOUPE_SIZE.step;
const BIG_STEP = 40;
const BAR_HEIGHT = 44;
// The bar, the hint line under it and the gaps above and below the hint.
const BAR_BLOCK_HEIGHT = BAR_HEIGHT + 8 + 20 + 20;
const VIEWPORT_MARGIN = 32;
const ANNOUNCE_DELAY_MS = 400;
const LARGEST_SIZE: LoupeSize = { width: LOUPE_SIZE.width.max, height: LOUPE_SIZE.height.max };

const ARROW_DELTAS: Record<string, { x: number; y: number }> = {
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: -1 },
};

// -- Helpers ------------------------------------------------------------------

function windowSize(): LoupeSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

function cardHeightAt(size: LoupeSize): number {
  return loupeCanvas(size).height + LOUPE_FIXED.cardY;
}

function useWindowSize(): LoupeSize {
  const [size, setSize] = useState(windowSize);
  useEffect(() => {
    const handleResize = () => setSize(windowSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}

// -- Components ---------------------------------------------------------------

const LoupeSizeStage: React.FC<LoupeSizeStageProps> = ({ onClose }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const hintId = useId();
  const { refs, context } = useFloating({ open: true, onOpenChange: (open) => !open && onClose() });
  const [target] = useState(() => previewLoupeTarget(useProjectStore.getState().lines, livePlaybackTime()));
  const [announcement, setAnnouncement] = useState("");
  const viewport = useWindowSize();
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  const loupeWidth = useSettingsStore((s) => s.loupeWidth);
  const loupeHeight = useSettingsStore((s) => s.loupeHeight);
  const spectrumStatus = useSpectrumStatus().status;

  const limits = useMemo(() => fitLoupeSize(LARGEST_SIZE, viewport, BAR_BLOCK_HEIGHT), [viewport]);
  const size = useMemo(() => {
    const stored = clampLoupeSize({ width: loupeWidth, height: loupeHeight });
    return { width: Math.min(stored.width, limits.width), height: Math.min(stored.height, limits.height) };
  }, [loupeWidth, loupeHeight, limits]);
  const atLimit =
    (size.width === limits.width && limits.width < LOUPE_SIZE.width.max) ||
    (size.height === limits.height && limits.height < LOUPE_SIZE.height.max);

  useEffect(
    () => () => {
      if (announceTimerRef.current !== null) clearTimeout(announceTimerRef.current);
    },
    [],
  );

  // Positions follow the live size and window, so they are written to the DOM rather than styled in JSX.
  useLayoutEffect(() => {
    const groupHeight = BAR_BLOCK_HEIGHT + cardHeightAt(limits);
    const barTop = Math.max(VIEWPORT_MARGIN, Math.round((viewport.height - groupHeight) / 2));
    const canvas = loupeCanvas(size);
    layerRef.current?.style.setProperty("--loupe-bar-top", `${barTop}px`);
    if (cardRef.current) {
      cardRef.current.style.left = `${Math.round((viewport.width - canvas.width - LOUPE_FIXED.cardX) / 2)}px`;
      cardRef.current.style.top = `${barTop + BAR_BLOCK_HEIGHT}px`;
    }
    if (placeholderRef.current) {
      placeholderRef.current.style.width = `${canvas.width}px`;
      placeholderRef.current.style.height = `${canvas.height}px`;
    }
  }, [size, limits, viewport]);

  const writeSize = (next: LoupeSize) => {
    if (next.width === size.width && next.height === size.height) return;
    const { set } = useSettingsStore.getState();
    set("loupeWidth", next.width);
    set("loupeHeight", next.height);
    if (announceTimerRef.current !== null) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(
      () => setAnnouncement(`${next.width} by ${next.height} pixels`),
      ANNOUNCE_DELAY_MS,
    );
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROW_DELTAS[event.key];
    if (!direction || event.target !== event.currentTarget) return;
    event.preventDefault();
    const step = event.shiftKey ? BIG_STEP : STEP;
    // resizedLoupe counts a width delta twice because the card grows on both sides.
    writeSize(resizedLoupe(size, { x: (direction.x * step) / 2, y: direction.y * step }, "xy", limits));
  };

  const resetSize = () => {
    writeSize({ width: LOUPE_SIZE.width.default, height: LOUPE_SIZE.height.default });
    cardRef.current?.focus();
  };

  const emptyMessage = !showSpectrum ? (
    <span onClickCapture={onClose}>
      Turn on <SettingLink setting="showSpectrum" /> to preview the loupe.
    </span>
  ) : target === null ? (
    "Sync a word to preview the loupe."
  ) : null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal returnFocus outsideElementsInert initialFocus={cardRef}>
        <div ref={layerRef} className="fixed inset-0 layer-floating modal-scrim">
          <div
            ref={refs.setFloating}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-0 outline-none"
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-(--loupe-bar-top) h-11 flex items-center gap-2 pl-3.5 pr-1.5 rounded-[14px] whitespace-nowrap select-none surface-floating">
              <span id={titleId} className="text-[13.5px] font-semibold text-composer-text">
                Loupe size
              </span>
              <span className="min-w-[9ch] font-mono text-[12.5px] font-medium tabular-nums text-(--label) select-text">
                {size.width} × {size.height}
              </span>
              {atLimit && <span className="text-xs text-(--muted)">Largest that fits this window</span>}
              <span className="w-2" />
              <Button variant="ghost" disabled={isDefaultLoupeSize(size)} onClick={resetSize}>
                Reset size
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
            <p
              id={hintId}
              className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--loupe-bar-top)+52px)] text-xs text-(--muted) whitespace-nowrap select-none"
            >
              Drag the edges or the corner. With the loupe focused, arrow keys change the size, Shift for bigger steps.
            </p>
            <div
              ref={cardRef}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys on the focused card are the keyboard path for the resize handles
              tabIndex={0}
              role="group"
              aria-roledescription="resizable preview"
              aria-label="Loupe preview"
              aria-describedby={hintId}
              onKeyDown={handleCardKeyDown}
              className={cn(
                LOUPE_CARD_SURFACE,
                "absolute select-none outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--edge),0_0_0_2px_var(--color-composer-accent),0_22px_48px_-14px_rgb(var(--shade)/0.7)]",
              )}
            >
              {emptyMessage === null && target ? (
                <LoupeCardBody target={target} size={size}>
                  {spectrumStatus === "idle" && (
                    <p className="px-1.5 pt-2 pb-0.5 text-[11.5px] text-(--muted)">
                      The spectrum fills in while the Timeline tab is open.
                    </p>
                  )}
                </LoupeCardBody>
              ) : (
                <>
                  <div className="h-8" />
                  <div
                    ref={placeholderRef}
                    className="flex items-center justify-center px-6 rounded-[10px] bg-(--layer-1) text-center text-[12.5px] text-(--muted) text-pretty"
                  >
                    {emptyMessage}
                  </div>
                </>
              )}
              <LoupeSizeHandles size={size} limits={limits} onResize={writeSize} />
            </div>
            <div role="status" className="sr-only">
              {announcement}
            </div>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

const LoupeSizeLayer: React.FC<LoupeSizeLayerProps> = ({ open, onClose }) => {
  useEscapeLayer("modal", open, onClose);
  if (!open) return null;
  return <LoupeSizeStage onClose={onClose} />;
};

// -- Exports ------------------------------------------------------------------

export { LoupeSizeLayer };
