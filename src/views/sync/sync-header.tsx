import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { IconLanguage, IconLock, IconLockOpen, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";

interface SyncHeaderProps {
  progressText: string;
  textVariant: "original" | "transliteration";
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

const SyncHeader: React.FC<SyncHeaderProps> = ({
  progressText,
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
    <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-medium">Sync</h2>
        <span className="font-mono text-sm text-composer-text-muted tabular-nums">{progressText}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          hasIcon
          size="sm"
          variant={textVariant === "transliteration" ? "primary" : "ghost"}
          disabled={!hasTransliteration}
          onClick={toggleTextVariant}
          title="Toggle original / transliteration text"
        >
          <IconLanguage className="size-4" />
          {textVariant === "transliteration" ? "Transliteration" : "Original"}
          {showShortcutHints && <InlineKeyBadge keys={getEffectiveKeysArray("sync.toggleTextVariant")} />}
        </Button>
        <div className="flex h-8 rounded-lg bg-composer-bg-elevated p-0.5">
          <button
            type="button"
            onClick={() => handleGranularityChange("line")}
            className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
              granularity === "line"
                ? "bg-composer-button text-composer-text"
                : "text-composer-text-muted hover:text-composer-text"
            }`}
          >
            Line
          </button>
          <button
            type="button"
            onClick={() => handleGranularityChange("word")}
            className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
              granularity === "word"
                ? "bg-composer-button text-composer-text"
                : "text-composer-text-muted hover:text-composer-text"
            }`}
          >
            Word
          </button>
        </div>
        <Button
          hasIcon
          variant={editMode ? "primary" : "secondary"}
          onClick={handleToggleEdit}
          title={editMode ? "Done editing, back to syncing" : "Edit timings (pauses playback)"}
        >
          {editMode ? <IconLock className="size-4" /> : <IconLockOpen className="size-4" />}
          {editMode ? "Done" : "Edit"}
        </Button>
        {isActive && !editMode && (
          <Button hasIcon onClick={handleReset}>
            <IconRefresh className="size-4" />
            Reset
          </Button>
        )}
        {!isActive && !editMode && (
          <Button hasIcon variant="primary" onClick={handleStartSync}>
            <IconPlayerPlayFilled className="size-4" />
            Start
          </Button>
        )}
      </div>
    </div>
  );
};

export { SyncHeader };
