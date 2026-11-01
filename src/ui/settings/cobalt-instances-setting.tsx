import { BUILTIN_COBALT_INSTANCE, DEFAULT_COBALT_INSTANCE_ID, useSettingsStore } from "@/stores/settings";
import { CobaltInstanceAddForm, CobaltInstanceEditRow } from "@/ui/settings/cobalt-instance-forms";
import { CobaltDirectoryLink, CobaltInstanceRow } from "@/ui/settings/cobalt-instances";
import { SettingText } from "@/ui/settings/setting-text";
import { useState } from "react";

// -- Component -----------------------------------------------------------------

const CobaltInstancesSetting: React.FC = () => {
  const cobaltInstances = useSettingsStore((s) => s.cobaltInstances);
  const selectedCobaltInstanceId = useSettingsStore((s) => s.selectedCobaltInstanceId);
  const cobaltInstanceStatus = useSettingsStore((s) => s.cobaltInstanceStatus);
  const addCobaltInstance = useSettingsStore((s) => s.addCobaltInstance);
  const updateCobaltInstance = useSettingsStore((s) => s.updateCobaltInstance);
  const removeCobaltInstance = useSettingsStore((s) => s.removeCobaltInstance);
  const selectCobaltInstance = useSettingsStore((s) => s.selectCobaltInstance);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="py-3">
      <div className="mb-3">
        <SettingText id="cobaltInstances" />
      </div>

      <div className="flex flex-col gap-1">
        <CobaltInstanceRow
          instance={BUILTIN_COBALT_INSTANCE}
          isSelected={selectedCobaltInstanceId === DEFAULT_COBALT_INSTANCE_ID}
          onSelect={() => selectCobaltInstance(DEFAULT_COBALT_INSTANCE_ID)}
        />
        {cobaltInstances.map((inst) =>
          editingId === inst.id ? (
            <CobaltInstanceEditRow
              key={inst.id}
              initialLabel={inst.label}
              initialUrl={inst.url}
              onSave={(label, url) => {
                updateCobaltInstance(inst.id, { label, url });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <CobaltInstanceRow
              key={inst.id}
              instance={inst}
              isSelected={selectedCobaltInstanceId === inst.id}
              onSelect={() => selectCobaltInstance(inst.id)}
              onRemove={() => removeCobaltInstance(inst.id)}
              onEdit={() => setEditingId(inst.id)}
              status={cobaltInstanceStatus[inst.id]}
            />
          ),
        )}
      </div>

      <CobaltInstanceAddForm onAdd={(label, url) => addCobaltInstance({ label, url })} />

      <CobaltDirectoryLink />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { CobaltInstancesSetting };
