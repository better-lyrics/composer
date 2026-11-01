import { useSettingsStore } from "@/stores/settings";
import { LIBRARY_VIEW_OPTIONS } from "@/ui/projects/library-options";
import { SegmentedControl } from "@/ui/segmented-control";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";

// -- Component -----------------------------------------------------------------

const LibraryViewSetting: React.FC = () => {
  const libraryView = useSettingsStore((state) => state.libraryView);
  const set = useSettingsStore((state) => state.set);

  return (
    <SettingRowLayout>
      <SettingText id="libraryView" />
      <SegmentedControl
        aria-label="Library view"
        value={libraryView}
        options={LIBRARY_VIEW_OPTIONS}
        onChange={(view) => set("libraryView", view)}
      />
    </SettingRowLayout>
  );
};

// -- Exports -------------------------------------------------------------------

export { LibraryViewSetting };
