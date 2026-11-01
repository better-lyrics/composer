import { type LoupeResizeAxis, type LoupeSize, resizedLoupe } from "@/domain/spectrum/loupe-size";
import { cn } from "@/utils/cn";
import { useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface LoupeSizeHandlesProps {
  size: LoupeSize;
  limits: LoupeSize;
  onResize: (size: LoupeSize) => void;
}

interface HandleProps extends LoupeSizeHandlesProps {
  axis: LoupeResizeAxis;
}

interface DragStart {
  x: number;
  y: number;
  size: LoupeSize;
}

// -- Constants ----------------------------------------------------------------

const EDGE_PILL =
  "before:absolute before:rounded-full before:bg-composer-text before:opacity-30 before:transition-opacity hover:before:opacity-80 data-dragging:before:opacity-80";

const HANDLE_STYLES: Record<LoupeResizeAxis, string> = {
  x: cn(
    EDGE_PILL,
    "z-1 top-6 bottom-6 -right-2 w-4 cursor-ew-resize before:top-1/2 before:left-[7px] before:w-0.5 before:h-8 before:-translate-y-1/2",
  ),
  y: cn(
    EDGE_PILL,
    "z-1 left-6 right-6 -bottom-2 h-4 cursor-ns-resize before:left-1/2 before:top-[7px] before:h-0.5 before:w-8 before:-translate-x-1/2",
  ),
  xy: "z-2 -right-2 -bottom-2 size-7 cursor-nwse-resize before:absolute before:right-[11px] before:bottom-[11px] before:size-2.5 before:border-r-2 before:border-b-2 before:border-(--label) before:rounded-br-[10px] before:transition-[border-color] hover:before:border-composer-text data-dragging:before:border-composer-text",
};

// -- Components ---------------------------------------------------------------

const Handle: React.FC<HandleProps> = ({ axis, size, limits, onResize }) => {
  const dragStartRef = useRef<DragStart | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY, size };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const delta = { x: event.clientX - start.x, y: event.clientY - start.y };
    onResize(resizedLoupe(start.size, delta, axis, limits));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  return (
    <span
      aria-hidden="true"
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn("absolute touch-none", HANDLE_STYLES[axis])}
    />
  );
};

const LoupeSizeHandles: React.FC<LoupeSizeHandlesProps> = (props) => (
  <>
    <Handle axis="x" {...props} />
    <Handle axis="y" {...props} />
    <Handle axis="xy" {...props} />
  </>
);

// -- Exports ------------------------------------------------------------------

export { LoupeSizeHandles };
