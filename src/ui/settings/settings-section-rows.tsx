import { useSettingsStore } from "@/stores/settings";
import {
  type SettingId,
  type SettingsGroupId,
  type SettingsSectionId,
  settingEntry,
  settingIdsInSection,
  visibleSettingIds,
} from "@/stores/settings-catalog";
import { SettingsGroup } from "@/ui/settings/setting-controls";
import { SettingRow } from "@/ui/settings/setting-row";
import { useShallow } from "zustand/react/shallow";

// -- Types --------------------------------------------------------------------

interface SettingRowRun {
  group: SettingsGroupId | undefined;
  ids: SettingId[];
}

// -- Helpers ------------------------------------------------------------------

function runsOf(ids: readonly SettingId[]): SettingRowRun[] {
  const runs: SettingRowRun[] = [];
  for (const id of ids) {
    const group = settingEntry(id).group;
    const last = runs[runs.length - 1];
    if (last && last.group === group) last.ids.push(id);
    else runs.push({ group, ids: [id] });
  }
  return runs;
}

// -- Component -----------------------------------------------------------------

const SettingsSectionRows: React.FC<{ section: SettingsSectionId }> = ({ section }) => {
  const ids = settingIdsInSection(section);
  const visibleIds = useSettingsStore(useShallow((state) => visibleSettingIds(ids, state)));

  return (
    <div className="divide-y divide-composer-border">
      {runsOf(visibleIds).map((run) =>
        run.group ? (
          <SettingsGroup key={run.ids[0]} title={run.group}>
            {run.ids.map((id) => (
              <SettingRow key={id} id={id} />
            ))}
          </SettingsGroup>
        ) : (
          run.ids.map((id) => <SettingRow key={id} id={id} />)
        ),
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SettingsSectionRows };
