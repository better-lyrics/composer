import { type SettingsState, useSettingsStore } from "@/stores/settings";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface ConfirmationToggleProps {
  label: string;
  description: string;
  settingKey: keyof SettingsState;
}

// -- Internal -----------------------------------------------------------------

const ConfirmationToggle: React.FC<ConfirmationToggleProps> = ({ label, description, settingKey }) => {
  const value = useSettingsStore((s) => s[settingKey]) as boolean;
  const set = useSettingsStore((s) => s.set);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-composer-text">{label}</span>
        <span className="text-xs text-composer-text-muted">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => set(settingKey, !value)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          value ? "bg-composer-accent" : "bg-composer-button",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
            value ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
};

// -- Component ----------------------------------------------------------------

const ConfirmationsSettingsSection: React.FC = () => {
  return (
    <div className="py-3">
      <div className="flex flex-col gap-0.5 mb-3">
        <span className="text-sm font-medium text-composer-text">Confirmation prompts</span>
        <span className="text-xs text-composer-text-muted">
          Toggle confirmation prompts for actions that can lose work. Turn one off to skip its warning until you
          re-enable it here.
        </span>
      </div>
      <div className="divide-y divide-composer-border">
        <ConfirmationToggle
          label="Confirm replacing project from URL"
          description="Show a warning when an import URL would replace your current project."
          settingKey="confirmReplaceProjectFromHash"
        />
        <ConfirmationToggle
          label="Confirm replacing lyrics on import"
          description="Show a warning when importing lyrics into a project that already has lines."
          settingKey="confirmReplaceLyrics"
        />
        <ConfirmationToggle
          label="Confirm resetting sync timing"
          description="Show a warning before clearing every word and line timing in the sync view."
          settingKey="confirmSyncReset"
        />
        <ConfirmationToggle
          label="Confirm clearing project"
          description="Show a warning before discarding the current project, metadata, and audio file."
          settingKey="confirmClearProject"
        />
        <ConfirmationToggle
          label="Confirm resetting all settings"
          description="Show a warning before restoring all settings to their defaults."
          settingKey="confirmResetSettings"
        />
        <ConfirmationToggle
          label="Confirm resetting all shortcuts"
          description="Show a warning before clearing all custom keyboard bindings."
          settingKey="confirmResetShortcuts"
        />
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ConfirmationsSettingsSection };
