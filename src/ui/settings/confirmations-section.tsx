import { SettingsSectionRows } from "@/ui/settings/settings-section-rows";

// -- Confirmations Section ----------------------------------------------------

const ConfirmationsSection: React.FC = () => {
  return (
    <div className="py-3">
      <div className="flex flex-col gap-0.5 mb-3">
        <span className="text-sm font-medium text-composer-text">Confirmation prompts</span>
        <span className="text-xs text-composer-text-muted">
          Toggle confirmation prompts for actions that can lose work. Turn one off to skip its warning until you
          re-enable it here.
        </span>
      </div>
      <SettingsSectionRows section="confirmations" />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { ConfirmationsSection };
