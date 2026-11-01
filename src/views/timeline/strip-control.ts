// -- Constants -----------------------------------------------------------------

const STRIP_BAR = "flex h-12 shrink-0 select-none items-center gap-2.5 border-b border-(--divider) px-2 text-xs";
const STRIP_TRAY = "tray shrink-0";
const STRIP_CONTROL = "h-7 rounded-lg";
const STRIP_TAG = "h-9! max-w-64! gap-1.5! rounded-xl! px-3! text-[13px]!";

// -- Functions -----------------------------------------------------------------

function stripTint(color: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${color} 7%, var(--color-composer-bg-dark))` };
}

// -- Exports -------------------------------------------------------------------

export { STRIP_BAR, STRIP_CONTROL, STRIP_TAG, STRIP_TRAY, stripTint };
