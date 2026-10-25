import { getEffectiveKeysArray, getShortcutDescription } from "@/stores/shortcut-bindings";
import { Key } from "@/ui/key";
import { TimingDisplay } from "@/views/sync/timing-display";

interface SyncGestureControlsProps {
  currentWord?: string;
  displayWord?: string;
  isHolding: boolean;
  showPulse: boolean;
  handleHoldPointerDown: React.PointerEventHandler<HTMLButtonElement>;
  handleHoldPointerRelease: React.PointerEventHandler<HTMLButtonElement>;
  handleTapPointerDown: React.PointerEventHandler<HTMLButtonElement>;
}

const GESTURE_KEY =
  "w-[52px] [--key-height:56px] [--key-depth:4px] [--key-radius:999px] touch-none tap-highlight-none text-[11px] font-semibold text-(--muted) data-pressed:text-composer-accent-text";

const shortcutLabel = (id: string) => getEffectiveKeysArray(id).join(" ");

const SyncGestureControls: React.FC<SyncGestureControlsProps> = ({
  currentWord,
  displayWord,
  isHolding,
  showPulse,
  handleHoldPointerDown,
  handleHoldPointerRelease,
  handleTapPointerDown,
}) => (
  <div className="flex items-center justify-self-end gap-4">
    {currentWord && <span className="text-xl font-semibold text-composer-text">{displayWord ?? currentWord}</span>}
    <div className="flex items-center gap-2">
      <Key
        tabIndex={-1}
        aria-label={getShortcutDescription("sync.holdSync")}
        aria-pressed={isHolding}
        data-pressed={isHolding || undefined}
        onPointerDown={handleHoldPointerDown}
        onPointerUp={handleHoldPointerRelease}
        onPointerCancel={handleHoldPointerRelease}
        onPointerLeave={handleHoldPointerRelease}
        className={GESTURE_KEY}
      >
        {shortcutLabel("sync.holdSync")}
      </Key>
      <Key
        tabIndex={-1}
        aria-label={getShortcutDescription("sync.tap")}
        data-pressed={showPulse || undefined}
        data-lit={showPulse || undefined}
        onPointerDown={handleTapPointerDown}
        className={GESTURE_KEY}
      >
        {shortcutLabel("sync.tap")}
      </Key>
    </div>
  </div>
);

interface SyncFooterProps {
  lastSyncedTime?: number;
  isComplete: boolean;
  editMode: boolean;
  isPlaying: boolean;
  isActive: boolean;
  gestureControls: React.ReactNode;
  status?: React.ReactNode;
}

const SyncFooter: React.FC<SyncFooterProps> = ({
  lastSyncedTime,
  isComplete,
  editMode,
  isPlaying,
  isActive,
  gestureControls,
  status,
}) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 h-18 shrink-0 px-5 shadow-[inset_0_1px_0_var(--divider)] bg-[color-mix(in_oklab,var(--color-composer-bg-dark)_35%,transparent)]">
    <TimingDisplay lastSyncedTime={lastSyncedTime} />

    <div className="text-[13px] text-center text-(--muted)">
      {!isComplete && editMode && "Editing timings ・ click a word to re-record, or press Done to sync"}
      {status}
      {!status &&
        !isComplete &&
        !editMode &&
        !isPlaying &&
        isActive &&
        "Paused ・ Click a line to jump, or play to continue"}
    </div>

    {gestureControls}
  </div>
);

export { SyncFooter, SyncGestureControls };
