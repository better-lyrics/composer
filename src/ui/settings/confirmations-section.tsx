import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";

// -- Confirmations Section ----------------------------------------------------

const ConfirmationsSection: React.FC = () => {
  return (
    <div className="py-3">
      <div className="flex flex-col gap-0.5 mb-3">
        <span className="text-sm font-medium text-composer-text">Confirmation prompts</span>
        <span className="text-xs text-composer-text-muted">
          Choose which actions ask before they run. A prompt you turn off, or answer with "Don't ask again", stays off
          until you change it here.
        </span>
      </div>
      <SettingsSectionRows section="confirmations" />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ConfirmationsSection };
