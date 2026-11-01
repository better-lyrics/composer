import type { LanguageTextVariant } from "@/domain/language/display";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SegmentedControl } from "@/ui/segmented-control";
import { ShortcutToggleButton } from "@/ui/shortcut-toggle-button";
import { AutoAlignDropdown } from "@/views/sync/auto-align-dropdown";
import { IconLanguage, IconLock, IconLockOpen, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface SyncHeaderProps {
  progress: { done: number; total: number };
  textVariant: LanguageTextVariant;
  hasTransliteration: boolean;
  toggleTextVariant: () => void;
  granularity: "line" | "word";
  handleGranularityChange: (granularity: "line" | "word") => void;
  editMode: boolean;
  handleToggleEdit: () => void;
  isActive: boolean;
  handleReset: () => void;
  handleStartSync: () => void;
}

// -- Constants ----------------------------------------------------------------

const GRANULARITY_OPTIONS = [
  { value: "line", label: "Line" },
  { value: "word", label: "Word" },
] as const;

// -- Components ---------------------------------------------------------------

const SyncHeader: React.FC<SyncHeaderProps> = ({
  progress,
  textVariant,
  hasTransliteration,
  toggleTextVariant,
  granularity,
  handleGranularityChange,
  editMode,
  handleToggleEdit,
  isActive,
  handleReset,
  handleStartSync,
}) => {
  const showShortcutHints = useSettingsStore((s) => s.showShortcutHints);
  return (
    <div className="flex items-center justify-between gap-4 h-13 shrink-0 pl-5 pr-2 border-b border-(--divider)">
      <h2 className="sr-only">Sync</h2>
      <span className="flex items-baseline gap-1.5 text-[13px] text-(--muted) tabular-nums select-none">
        <b className="font-mono text-[15px] font-bold text-composer-text">{progress.done}</b> / {progress.total}{" "}
        {granularity === "word" ? "words" : "lines"} synced
      </span>
      <div className="flex items-center gap-3">
        <div className="tray">
          <ShortcutToggleButton
            active={textVariant === "transliteration"}
            label={textVariant === "transliteration" ? "Transliteration" : "Original"}
            stateInLabel
            shortcut="sync.toggleTextVariant"
            onClick={toggleTextVariant}
            disabled={!hasTransliteration}
            description="Toggle original / transliteration text"
          >
            <IconLanguage />
          </ShortcutToggleButton>
        </div>
        <SegmentedControl
          aria-label="Timing granularity"
          value={granularity}
          options={GRANULARITY_OPTIONS}
          onChange={handleGranularityChange}
        />
        <AutoAlignDropdown disabled={editMode} />
        <Button
          hasIcon
          size="lg"
          variant={editMode ? "primary" : "secondary"}
          onClick={handleToggleEdit}
          className={showShortcutHints ? "pr-1.5 [&>[data-inline-key-badge]]:ml-0" : undefined}
          title={editMode ? "Done editing, back to syncing" : "Edit timings (pauses playback)"}
        >
          {editMode ? <IconLock className="size-4" /> : <IconLockOpen className="size-4" />}
          {editMode ? "Done" : "Edit"}
          {showShortcutHints && <InlineKeyBadge keys={getEffectiveKeysArray("sync.toggleEdit")} />}
        </Button>
        {isActive && !editMode && (
          <Button hasIcon size="lg" onClick={handleReset}>
            <IconRefresh className="size-4" />
            Reset
          </Button>
        )}
        {!isActive && !editMode && (
          <Button hasIcon size="lg" variant="primary" onClick={handleStartSync}>
            <IconPlayerPlayFilled className="size-3.5" />
            Start
          </Button>
        )}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncHeader };
