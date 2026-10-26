import { BUILTIN_ALIGNMENT_MODEL, loadAlignmentModels } from "@/audio/alignment/hubertfa/model-manifest";
import { SelectSetting, type SelectOption } from "@/ui/settings/setting-controls";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { useEffect, useState } from "react";

// -- Constants -----------------------------------------------------------------

const BUILTIN_OPTION: SelectOption = { value: BUILTIN_ALIGNMENT_MODEL.id, label: BUILTIN_ALIGNMENT_MODEL.label };

// -- Component -----------------------------------------------------------------

// The choices come from the hosted manifest, so they load after the row renders.
const AlignmentModelSetting: React.FC = () => {
  const [options, setOptions] = useState<SelectOption[]>([BUILTIN_OPTION]);

  useEffect(() => {
    let live = true;
    void loadAlignmentModels().then((models) => {
      if (!live || models.length === 0) return;
      setOptions(models.map((m) => ({ value: m.id, label: `${m.label} (~${formatWholeMegabytes(m.approxBytes)})` })));
    });
    return () => {
      live = false;
    };
  }, []);

  return <SelectSetting id="alignmentModelId" options={options} />;
};

// -- Exports -------------------------------------------------------------------

export { AlignmentModelSetting };
