import { useSettingsStore } from "@/stores/settings";
import { changedSettingIds } from "@/stores/settings-catalog";
import { EmptyState } from "@/ui/empty-state";
import { SettingResultGroups } from "@/ui/settings/settings-search-results";
import { useMemo } from "react";

// -- Component -----------------------------------------------------------------

const ChangedSettings: React.FC = () => {
  const settingsState = useSettingsStore((s) => s);
  const settings = useMemo(() => changedSettingIds(settingsState), [settingsState]);

  if (settings.length === 0) {
    return (
      <div className="flex py-16">
        <EmptyState message="Every setting is at its default" hint="Settings you change show up here." />
      </div>
    );
  }

  return <SettingResultGroups results={{ settings, shortcuts: [] }} />;
};

// -- Exports -------------------------------------------------------------------

export { ChangedSettings };
