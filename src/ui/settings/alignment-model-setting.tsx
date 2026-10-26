import { BUILTIN_ALIGNMENT_MODEL, loadAlignmentModels } from "@/audio/alignment/hubertfa/model-manifest";
import { useSettingsStore } from "@/stores/settings";
import { type SelectOption, SelectSetting } from "@/ui/settings/setting-controls";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { useQuery } from "@tanstack/react-query";

// -- Constants -----------------------------------------------------------------

const BUILTIN_OPTION: SelectOption = { value: BUILTIN_ALIGNMENT_MODEL.id, label: BUILTIN_ALIGNMENT_MODEL.label };

// -- Component -----------------------------------------------------------------

// The choices come from the hosted manifest, which loads once per page and is
// shared with auto-align, so the query neither refetches nor cancels it.
const AlignmentModelSetting: React.FC = () => {
  const stored = useSettingsStore((s) => s.alignmentModelId);
  const { data: models } = useQuery({
    queryKey: ["alignment-models"],
    queryFn: loadAlignmentModels,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });

  if (!models) {
    const pending = stored === BUILTIN_OPTION.value ? [] : [{ value: stored, label: "Loading…" }];
    return <SelectSetting id="alignmentModelId" options={[BUILTIN_OPTION, ...pending]} />;
  }
  const options =
    models.length > 0
      ? models.map((m) => ({ value: m.id, label: `${m.label} (~${formatWholeMegabytes(m.approxBytes)})` }))
      : [BUILTIN_OPTION];
  // A checkpoint that left the manifest isn't what auto-align uses; name the built-in model it falls back to.
  const displayValue = options.some((o) => o.value === stored) ? stored : BUILTIN_OPTION.value;
  return <SelectSetting id="alignmentModelId" options={options} displayValue={displayValue} />;
};

// -- Exports -------------------------------------------------------------------

export { AlignmentModelSetting };
