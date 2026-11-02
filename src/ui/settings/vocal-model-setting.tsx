import { VOCAL_MODEL_APPROX_BYTES, getModelBaseUrl } from "@/audio/separation/model-registry";
import type { RoformerSupport } from "@/audio/separation/roformer/availability";
import { roformerTerms } from "@/audio/separation/roformer/model-parts";
import { releaseIdleRoformer } from "@/audio/separation/shared-separation-worker";
import { useRoformerSupport } from "@/hooks/useRoformerSupport";
import { settingEntry } from "@/stores/settings-catalog";
import { type VocalModelVariant, useSettingsStore } from "@/stores/settings";
import { ModelTermsHint, ModelTermsInfo } from "@/ui/model-terms-info";
import { OptionLabel, Select, type SelectOption } from "@/ui/select";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { formatWholeMegabytes } from "@/utils/format-file-size";

// -- Constants -----------------------------------------------------------------

const VOCAL_MODEL_LABELS: Record<VocalModelVariant, string> = {
  fp16: "fp16",
  fp32: "fp32",
  roformer: "High quality vocals",
};

// Measured on an Intel UHD 630: 34 minutes for a 3.5-minute song, against about 3.4 for fp16.
const ROFORMER_SPEED = "About 10x slower than fp16: ~35 min a song on integrated graphics";

// -- Helpers -------------------------------------------------------------------

function vocalModelOptions(support: RoformerSupport | null): SelectOption[] {
  return [
    {
      value: "fp16",
      label: VOCAL_MODEL_LABELS.fp16,
      badge: "Recommended",
      detail: `${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES.fp16)} · Uses fp32 without WebGPU shader-f16`,
    },
    {
      value: "fp32",
      label: VOCAL_MODEL_LABELS.fp32,
      detail: `${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES.fp32)} · Full precision`,
    },
    {
      value: "roformer",
      label: VOCAL_MODEL_LABELS.roformer,
      disabled: support?.supported === false,
      detail:
        support?.supported === false
          ? support.reason
          : `${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES.roformer)} · ${ROFORMER_SPEED}`,
    },
  ];
}

// -- Components ----------------------------------------------------------------

const VocalModelSetting: React.FC = () => {
  const value = useSettingsStore((s) => s.vocalModelVariant);
  const set = useSettingsStore((s) => s.set);
  const support = useRoformerSupport();
  const baseUrl = getModelBaseUrl();
  const terms = baseUrl ? roformerTerms(baseUrl) : null;

  const onChange = (next: string) => {
    if (next === value) return;
    set("vocalModelVariant", next as VocalModelVariant);
    // The RoFormer keeps its sessions for the next song; picking another model frees them.
    if (value === "roformer") void releaseIdleRoformer();
  };

  return (
    <SettingRowLayout>
      <SettingText id="vocalModelVariant" />
      <span className="flex items-center gap-1">
        {value === "roformer" && terms && <ModelTermsInfo terms={terms} />}
        <Select
          aria-label={settingEntry("vocalModelVariant").label}
          value={value}
          onChange={onChange}
          options={vocalModelOptions(support)}
          renderOption={(option) => (
            <span className="flex flex-1 items-center gap-3 min-w-0">
              <OptionLabel option={option} />
              {option.value === "roformer" && terms && <ModelTermsHint terms={terms} />}
            </span>
          )}
        />
      </span>
    </SettingRowLayout>
  );
};

// -- Exports -------------------------------------------------------------------

export { VOCAL_MODEL_LABELS, VocalModelSetting };
