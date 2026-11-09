import { askToStartGuideOver } from "@/guide/start-over";
import { unmuteGuideCategories } from "@/lib/guide-signals";
import { useConfirm } from "@/stores/confirm-store";
import { useGuideStore } from "@/stores/guide";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { pluralize } from "@/utils/pluralize";
import { IconCompass, IconRefresh } from "@tabler/icons-react";

// -- Rows ---------------------------------------------------------------------

const ResetGuideSetting: React.FC = () => (
  <SettingRowLayout>
    <SettingText id="resetGuide" />
    <Button size="lg" variant="secondary" hasIcon onClick={askToStartGuideOver}>
      <IconCompass size={14} />
      Start over
    </Button>
  </SettingRowLayout>
);

const UnmuteGuideHintsSetting: React.FC = () => {
  const mutedCount = useGuideStore((state) => state.mutedCategories.length);
  return (
    <SettingRowLayout>
      <SettingText id="unmuteGuideHints" />
      <Button size="lg" variant="secondary" disabled={mutedCount === 0} onClick={() => unmuteGuideCategories()}>
        {mutedCount === 0 ? "None off" : `Turn ${pluralize(mutedCount, "kind")} back on`}
      </Button>
    </SettingRowLayout>
  );
};

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

export { ResetAllSettingsSetting, ResetGuideSetting, UnmuteGuideHintsSetting };
