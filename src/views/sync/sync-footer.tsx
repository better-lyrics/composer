import { getEffectiveKeysArray, getShortcutDescription } from "@/stores/shortcut-bindings";
import { syncCarouselTransition, syncPulseVariants } from "@/utils/animationVariants";
import { TimingDisplay } from "@/views/sync/timing-display";
import { m } from "motion/react";

interface SyncGestureControlsProps {
  currentWord?: string;
  displayWord?: string;
  isHolding: boolean;
  showPulse: boolean;
  handleHoldPointerDown: React.PointerEventHandler<HTMLButtonElement>;
  handleHoldPointerRelease: React.PointerEventHandler<HTMLButtonElement>;
  handleTapPointerDown: React.PointerEventHandler<HTMLButtonElement>;
}

const SyncGestureControls: React.FC<SyncGestureControlsProps> = ({
  currentWord,
  displayWord,
  isHolding,
  showPulse,
  handleHoldPointerDown,
  handleHoldPointerRelease,
  handleTapPointerDown,
}) => (
  <div className="flex items-center gap-4">
    {currentWord && <span className="text-xl font-medium text-composer-text">{displayWord ?? currentWord}</span>}
    <div className="flex items-center gap-2">
      <m.button
        type="button"
        tabIndex={-1}
        aria-label={getShortcutDescription("sync.holdSync")}
        aria-pressed={isHolding}
        onPointerDown={handleHoldPointerDown}
        onPointerUp={handleHoldPointerRelease}
        onPointerCancel={handleHoldPointerRelease}
        onPointerLeave={handleHoldPointerRelease}
        variants={syncPulseVariants}
        initial={false}
        animate={isHolding ? "pulse" : "idle"}
        transition={syncCarouselTransition}
        className={`flex items-center justify-center border-2 rounded-full size-14 cursor-pointer touch-none tap-highlight-none ${
          isHolding ? "bg-composer-accent/20 border-composer-accent" : "bg-composer-bg-elevated"
        }`}
      >
        <span className="text-xs font-medium text-composer-text-muted">
          {getEffectiveKeysArray("sync.holdSync")
            .map((k) => k.toUpperCase())
            .join(" ")}
        </span>
      </m.button>
      <m.button
        type="button"
        tabIndex={-1}
        aria-label={getShortcutDescription("sync.tap")}
        onPointerDown={handleTapPointerDown}
        variants={syncPulseVariants}
        initial={false}
        animate={showPulse ? "pulse" : "idle"}
        transition={syncCarouselTransition}
        className="flex items-center justify-center border-2 rounded-full size-14 cursor-pointer touch-none tap-highlight-none bg-composer-bg-elevated"
      >
        <span className="text-xs font-medium text-composer-text-muted">
          {getEffectiveKeysArray("sync.tap")
            .map((k) => k.toUpperCase())
            .join(" ")}
        </span>
      </m.button>
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
}

const SyncFooter: React.FC<SyncFooterProps> = ({
  lastSyncedTime,
  isComplete,
  editMode,
  isPlaying,
  isActive,
  gestureControls,
}) => (
  <div className="px-6 py-4 border-t border-composer-border bg-composer-bg-dark">
    <div className="flex items-center justify-between h-14">
      <TimingDisplay lastSyncedTime={lastSyncedTime} />

      {!isComplete && editMode && (
        <div className="text-sm text-composer-text-muted">
          Editing timings ・ click a word to re-record, or press Done to sync
        </div>
      )}

      {gestureControls}

      {!isComplete && !editMode && !isPlaying && isActive && (
        <div className="text-sm text-composer-text-muted">Paused ・ Click a line to jump, or play to continue</div>
      )}
    </div>
  </div>
);

export { SyncFooter, SyncGestureControls };
