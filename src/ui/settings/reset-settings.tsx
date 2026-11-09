import { startGuideOver } from "@/lib/guide-signals";
import { useConfirm } from "@/stores/confirm-store";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { IconCompass, IconRefresh } from "@tabler/icons-react";

// -- Rows ---------------------------------------------------------------------

const ResetGuideSetting: React.FC = () => (
  <SettingRowLayout>
    <SettingText id="resetGuide" />
    <Button size="lg" variant="secondary" hasIcon onClick={() => startGuideOver()}>
      <IconCompass size={14} />
      Start over
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
      <Button size="lg" variant="secondary" hasIcon onClick={handleResetSettings}>
        <IconRefresh size={14} />
        Reset all
      </Button>
    </SettingRowLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export { ResetAllSettingsSetting, ResetGuideSetting };
