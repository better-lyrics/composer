import { Popover } from "@/ui/popover";
import { useEffect, useId, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface DeckKnobProps {
  label: string;
  valueText: string;
  // Position on the knob's arc, 0 to 1.
  fraction: number;
  onFraction: (fraction: number) => void;
  onStep: (direction: 1 | -1) => void;
  onReset: () => void;
  // Snapshots the current value and returns how to put it back, so Escape can cancel a drag exactly.
  rememberValue: () => () => void;
  children: React.ReactNode;
}

// -- Constants ----------------------------------------------------------------

const DRAG_PIXELS_FOR_FULL_TURN = 160;
const DRAG_THRESHOLD = 3;
const KEY_DIRECTIONS: Record<string, 1 | -1> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC = CIRCUMFERENCE * 0.75;

// -- Components ---------------------------------------------------------------

const KnobFace: React.FC<{ fraction: number }> = ({ fraction }) => {
  const gradientId = useId();
  const angle = (-135 + fraction * 270) * (Math.PI / 180);
  const tick = (length: number) => ({ x: 20 + Math.sin(angle) * length, y: 20 - Math.cos(angle) * length });
  const tickStart = tick(3);
  const tickEnd = tick(7.5);
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10 overflow-visible">
      <defs>
        <radialGradient id={gradientId} cx="40%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--knob-hi)" />
          <stop offset="1" stopColor="var(--knob-lo)" />
        </radialGradient>
      </defs>
      {[
        { length: ARC, className: "stroke-(--layer-3)" },
        { length: Math.max(ARC * fraction, 0.01), className: "stroke-composer-accent" },
      ].map(({ length, className }) => (
        <circle
          key={className}
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${length} ${CIRCUMFERENCE}`}
          transform="rotate(135 20 20)"
          className={className}
        />
      ))}
      <circle
        cx="20"
        cy="20"
        r="11.5"
        fill={`url(#${gradientId})`}
        className="stroke-(--edge-strong)"
        strokeWidth="1"
      />
      <line
        x1={tickStart.x}
        y1={tickStart.y}
        x2={tickEnd.x}
        y2={tickEnd.y}
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-composer-text"
      />
    </svg>
  );
};

const DeckKnob: React.FC<DeckKnobProps> = ({
  label,
  valueText,
  fraction,
  onFraction,
  onStep,
  onReset,
  rememberValue,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);
  const endDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => endDrag.current?.(), []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startFraction = fraction;
    const restore = rememberValue();
    const knob = event.currentTarget;
    dragged.current = false;
    knob.setPointerCapture(event.pointerId);
    const handleMove = (move: PointerEvent) => {
      const travel = move.clientX - startX + (startY - move.clientY);
      if (!dragged.current && Math.abs(travel) < DRAG_THRESHOLD) return;
      dragged.current = true;
      onFraction(Math.min(1, Math.max(0, startFraction + travel / DRAG_PIXELS_FOR_FULL_TURN)));
    };
    const handleUp = () => {
      knob.removeEventListener("pointermove", handleMove);
      knob.removeEventListener("pointerup", handleUp);
      knob.removeEventListener("pointercancel", handleUp);
      knob.removeEventListener("lostpointercapture", handleUp);
      window.removeEventListener("keydown", handleEscape, true);
      endDrag.current = null;
    };
    const handleEscape = (key: KeyboardEvent) => {
      if (key.key !== "Escape") return;
      key.preventDefault();
      key.stopPropagation();
      if (dragged.current) restore();
      handleUp();
    };
    knob.addEventListener("pointermove", handleMove);
    knob.addEventListener("pointerup", handleUp);
    knob.addEventListener("pointercancel", handleUp);
    knob.addEventListener("lostpointercapture", handleUp);
    window.addEventListener("keydown", handleEscape, true);
    endDrag.current = handleUp;
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    onStep(direction);
  };

  // A drag ends in a click; that click must not toggle the popover.
  const handleOpenChange = (next: boolean) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setOpen(next);
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      placement="top"
      aria-label={label}
      trigger={
        <button
          type="button"
          aria-label={`${label}, ${valueText}`}
          title="Drag to adjust, double-click to reset"
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => {
            onReset();
            setOpen(false);
          }}
          className="flex items-center gap-2 -mx-1 px-1 rounded-lg cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <KnobFace fraction={fraction} />
          <span className="flex flex-col w-[52px] text-left leading-[1.15] max-[1279px]:hidden">
            <span className="text-[11.5px] text-(--muted)">{label}</span>
            <span className="font-mono text-[13px] tabular-nums text-composer-text">{valueText}</span>
          </span>
        </button>
      }
    >
      {children}
    </Popover>
  );
};

// -- Exports ------------------------------------------------------------------

export { DeckKnob };
