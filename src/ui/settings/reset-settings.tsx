import { useConfirm } from "@/stores/confirm-store";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { resetTour } from "@/tour/use-tour";
import { Button } from "@/ui/button";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { IconRefresh, IconRoute } from "@tabler/icons-react";

// -- Actions ------------------------------------------------------------------

function restartTour(): void {
  resetTour();
  useUIStore.getState().closeSettings();
}

// -- Rows ---------------------------------------------------------------------

const ResetTourSetting: React.FC = () => (
  <SettingRowLayout>
    <SettingText id="resetTour" />
    <Button size="sm" variant="secondary" hasIcon onClick={restartTour}>
      <IconRoute size={14} />
      Reset tour
    </Button>
  </SettingRowLayout>
);

const ResetAllSettingsSetting: React.FC = () => {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const confirm = useConfirm();

  const handleResetSettings = async () => {
    const ok = await confirm({
      title: "Reset all settings?",
      description: "Restore every setting to its default value. Your project data is not affected.",
      confirmLabel: "Reset",
      variant: "destructive",
      settingsKey: "confirmResetSettings",
    });
    if (ok) resetToDefaults();
  };

  return (
    <SettingRowLayout>
      <SettingText id="resetAllSettings" />
      <Button size="sm" variant="secondary" hasIcon onClick={handleResetSettings}>
        <IconRefresh size={14} />
        Reset all
      </Button>
    </SettingRowLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export { ResetAllSettingsSetting, ResetTourSetting };
