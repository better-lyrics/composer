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
import { useWindowSize } from "@/hooks/use-window-size";
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
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";

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
// Room for the pitch hint and the idle note under the canvas, which come and go.
const NOTE_ROWS_HEIGHT = 2 * LOUPE_FIXED.noteRowHeight;
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

function cardHeightAt(size: LoupeSize): number {
  return loupeCanvas(size).height + LOUPE_FIXED.cardY + NOTE_ROWS_HEIGHT;
}

// -- Components ---------------------------------------------------------------

const LoupeSizeStage: React.FC<LoupeSizeStageProps> = ({ onClose }) => {
  const cardRef = useRef<HTMLDivElement>(null);
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

  const limits = useMemo(() => fitLoupeSize(LARGEST_SIZE, viewport, BAR_BLOCK_HEIGHT + NOTE_ROWS_HEIGHT), [viewport]);
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

  const canvas = loupeCanvas(size);
  const barTop = Math.max(VIEWPORT_MARGIN, Math.round((viewport.height - BAR_BLOCK_HEIGHT - cardHeightAt(limits)) / 2));
  const layout: CSSProperties = {
    "--loupe-bar-top": `${barTop}px`,
    "--loupe-card-top": `${barTop + BAR_BLOCK_HEIGHT}px`,
    "--loupe-canvas-w": `${canvas.width}px`,
    "--loupe-canvas-h": `${canvas.height}px`,
  };

  const announce = (next: LoupeSize) => {
    if (announceTimerRef.current !== null) clearTimeout(announceTimerRef.current);
    announceTimerRef.current = setTimeout(
      () => setAnnouncement(`${next.width} by ${next.height} pixels`),
      ANNOUNCE_DELAY_MS,
    );
  };

  // Only the axis the user moved is saved, so a window cap never overwrites the other one.
  const writeSize = (next: LoupeSize) => {
    const update: { loupeWidth?: number; loupeHeight?: number } = {};
    if (next.width !== size.width) update.loupeWidth = next.width;
    if (next.height !== size.height) update.loupeHeight = next.height;
    if (update.loupeWidth === undefined && update.loupeHeight === undefined) return;
    useSettingsStore.setState(update);
    announce(next);
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
    useSettingsStore.setState({ loupeWidth: LOUPE_SIZE.width.default, loupeHeight: LOUPE_SIZE.height.default });
    announce({ width: LOUPE_SIZE.width.default, height: LOUPE_SIZE.height.default });
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
        <div className="fixed inset-0 layer-floating modal-scrim" style={layout}>
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
              <Button
                variant="ghost"
                disabled={isDefaultLoupeSize({ width: loupeWidth, height: loupeHeight })}
                onClick={resetSize}
              >
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
                "absolute left-1/2 -translate-x-1/2 top-(--loupe-card-top) select-none outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--edge),0_0_0_2px_var(--color-composer-accent),0_22px_48px_-14px_rgb(var(--shade)/0.7)]",
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
                  <div className="w-(--loupe-canvas-w) h-(--loupe-canvas-h) flex items-center justify-center px-6 rounded-[10px] bg-(--layer-1) text-center text-[12.5px] text-(--muted) text-pretty">
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
