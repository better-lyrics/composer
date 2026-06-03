import { cn } from "@/utils/cn";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import { useProjectStore } from "@/stores/project";
import { stripSplitCharacter } from "@/utils/split-character";
import { selfKey } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { WordBlockRomanizationPopover } from "@/views/timeline/word-block-romanization-popover";
import { useDraggable } from "@dnd-kit/core";
import { useCallback, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface WordBlockProps {
  id: string;
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  romanization?: string;
  begin: number;
  end: number;
  color: string;
  zoom: number;
  isDimmed: boolean;
  isSelected: boolean;
  isExplicit?: boolean;
  syllablePosition?: SyllablePosition;
  gapBefore?: boolean;
  leftHighlighted?: boolean;
  rightHighlighted?: boolean;
  leftConjoined?: boolean;
  rightConjoined?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onResizeStart: (edge: "left" | "right", startX: number) => void;
  onEdgeHover?: (edge: "left" | "right", hovering: boolean) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// -- Component -----------------------------------------------------------------

const SYLLABLE_RADIUS: Record<SyllablePosition, string> = {
  none: "rounded-xl",
  first: "rounded-l-xl rounded-r-none",
  middle: "rounded-none",
  last: "rounded-r-xl rounded-l-none",
};

// Minimum natural cell width (px) below which romaji is hidden. Derived from
// a 12px main text line plus a 10px italic romaji line equals 22px of vertical
// content, plus a 1px gap on each side, rounded up to the next even width.
const ROMAJI_VISIBILITY_THRESHOLD = 24;

const WordBlock: React.FC<WordBlockProps> = ({
  id,
  lineId,
  lineIndex,
  wordIndex,
  trackType,
  text,
  romanization,
  begin,
  end,
  color,
  zoom,
  isDimmed,
  isSelected,
  isExplicit,
  syllablePosition = "none",
  gapBefore,
  leftHighlighted,
  rightHighlighted,
  leftConjoined,
  rightConjoined,
  onClick,
  onResizeStart,
  onEdgeHover,
  onDoubleClick,
  onContextMenu,
}) => {
  const left = begin * zoom;
  const naturalWidth = (end - begin) * zoom;
  const width = Math.max(naturalWidth, 4);
  const showText = naturalWidth >= 20;
  const primaryWordText = useTimelineStore((s) => s.primaryWordText);

  const sourceText = stripSplitCharacter(text);
  const hasRomaji = !!romanization && romanization.length > 0;
  const showRomajiAsPrimary = primaryWordText === "romaji" && hasRomaji;
  const primaryLabel = showRomajiAsPrimary ? (romanization as string) : sourceText;
  const subtextLabel = showRomajiAsPrimary ? sourceText : hasRomaji ? (romanization as string) : "";
  const showSubtext = subtextLabel.length > 0 && naturalWidth >= ROMAJI_VISIBILITY_THRESHOLD;

  const myKey = selfKey(lineId, wordIndex, trackType);
  const isSnapped = useTimelineStore((s) => s.snappedBlockId === myKey);

  const scheme = useProjectStore((s) => s.metadata.romanizationScheme);
  const hasWordTexts = useProjectStore(
    (s) => s.lines.find((l) => l.id === lineId)?.romanization?.wordTexts !== undefined,
  );
  const canShowRomanizationPopover = trackType === "word" && Boolean(scheme) && hasWordTexts;

  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const closePopover = useCallback(() => setPopoverOpen(false), []);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      lineId,
      lineIndex,
      wordIndex,
      trackType,
      text,
      begin,
      end,
      snap: { edgesAtStart: [begin, end] },
    },
  });

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const edge = e.currentTarget.dataset.edge as "left" | "right";
    onResizeStart(edge, e.clientX);
  };

  const syllableBorder: React.CSSProperties = {};
  if (!isSelected && (syllablePosition === "first" || syllablePosition === "middle")) {
    syllableBorder.borderRightStyle = "dashed";
  }
  if (!isSelected && (syllablePosition === "middle" || syllablePosition === "last")) {
    if (gapBefore) {
      syllableBorder.borderLeftStyle = "dashed";
    } else {
      syllableBorder.borderLeftWidth = 0;
    }
  }

  const setBlockRef = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      setPopoverAnchor(el);
    },
    [setNodeRef],
  );

  return (
    <>
      <div
        ref={setBlockRef}
        id={id}
        data-word-block
        data-syllable-position={syllablePosition}
        className={cn(
          "absolute top-1 bottom-1 flex items-center justify-center",
          "text-xs text-white truncate select-none cursor-grab",
          "border transition-opacity duration-100",
          SYLLABLE_RADIUS[syllablePosition],
          isDimmed && "opacity-30",
          isDragging && "opacity-50 cursor-grabbing z-50",
          isExplicit && "is-explicit-word",
          isSnapped && !isDragging && "is-snapped",
        )}
        style={{
          left,
          width,
          backgroundColor: isSelected ? `${color}60` : `${color}40`,
          borderColor: isSelected ? `${color}B0` : `${color}70`,
          ...syllableBorder,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.altKey && canShowRomanizationPopover) {
            e.preventDefault();
            setPopoverOpen(true);
            return;
          }
          onClick(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e);
        }}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick(e as unknown as React.MouseEvent);
        }}
      >
        <div
          data-edge="left"
          role="separator"
          aria-orientation="vertical"
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-0 bottom-0 w-2 z-10 hover:bg-white/10",
            syllablePosition === "middle" || syllablePosition === "last" || leftConjoined
              ? "cursor-col-resize"
              : "cursor-ew-resize",
            leftHighlighted && "bg-white/10",
          )}
          onMouseDown={handleResizeStart}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => onEdgeHover?.("left", true)}
          onMouseLeave={() => onEdgeHover?.("left", false)}
        />

        {showText && (
          <span className="flex flex-col items-center justify-center min-w-0 px-1 pointer-events-none">
            <span data-testid="word-primary" className="truncate max-w-full leading-tight">
              {primaryLabel}
            </span>
            {showSubtext && (
              <span
                data-testid="word-romanization"
                className={cn(
                  "truncate text-ellipsis max-w-full text-[10px] leading-tight opacity-70 pointer-events-none",
                  !showRomajiAsPrimary && "italic",
                )}
              >
                {subtextLabel}
              </span>
            )}
          </span>
        )}

        <div
          data-edge="right"
          role="separator"
          aria-orientation="vertical"
          aria-hidden="true"
          className={cn(
            "absolute right-0 top-0 bottom-0 w-2 z-10 hover:bg-white/10",
            syllablePosition === "first" || syllablePosition === "middle" || rightConjoined
              ? "cursor-col-resize"
              : "cursor-ew-resize",
            rightHighlighted && "bg-white/10",
          )}
          onMouseDown={handleResizeStart}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => onEdgeHover?.("right", true)}
          onMouseLeave={() => onEdgeHover?.("right", false)}
        />
      </div>
      {canShowRomanizationPopover && scheme && (
        <WordBlockRomanizationPopover
          lineId={lineId}
          wordIndex={wordIndex}
          scheme={scheme}
          anchorEl={popoverAnchor}
          isOpen={popoverOpen}
          onClose={closePopover}
        />
      )}
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { WordBlock };
