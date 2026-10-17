import { useSettingsStore } from "@/stores/settings";
import { type SettingId, settingDescription, settingEntry } from "@/stores/settings-catalog";
import { HighlightMatches } from "@/ui/highlight-matches";
import { useSettingsSearchQuery } from "@/ui/settings/settings-search-query";

// -- Types ---------------------------------------------------------------------

interface SettingTextProps {
  id: SettingId;
  badge?: React.ReactNode;
  description?: React.ReactNode;
}

// -- Component -----------------------------------------------------------------

const SettingText: React.FC<SettingTextProps> = ({ id, badge, description }) => {
  const { label } = settingEntry(id);
  const catalogDescription = useSettingsStore((state) => settingDescription(id, state));
  const query = useSettingsSearchQuery();
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-2 text-sm font-medium text-composer-text">
        <span>
          <HighlightMatches text={label} query={query} />
        </span>
        {badge}
      </span>
      <span className="text-xs text-composer-text-muted text-pretty">
        {description ?? <HighlightMatches text={catalogDescription} query={query} />}
      </span>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SettingText };
