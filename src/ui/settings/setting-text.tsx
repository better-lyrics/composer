import { type SettingId, settingEntry } from "@/stores/settings-catalog";
import { HighlightMatches } from "@/ui/highlight-matches";
import { useSettingsSearchQuery } from "@/ui/settings/settings-search-query";

// -- Component -----------------------------------------------------------------

const SettingText: React.FC<{ id: SettingId }> = ({ id }) => {
  const { label, description } = settingEntry(id);
  const query = useSettingsSearchQuery();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-composer-text">
        <HighlightMatches text={label} query={query} />
      </span>
      <span className="text-xs text-composer-text-muted">
        <HighlightMatches text={description} query={query} />
      </span>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SettingText };
