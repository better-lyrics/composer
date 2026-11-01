import { useSettingsStore } from "@/stores/settings";
import { changedSettingIds } from "@/stores/settings-catalog";
import { EmptyState } from "@/ui/empty-state";
import { SettingResultGroups } from "@/ui/settings/settings-search-results";
import { useState } from "react";

// -- Component -----------------------------------------------------------------

const ChangedSettings: React.FC = () => {
  const [settings] = useState(() => changedSettingIds(useSettingsStore.getState()));

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
