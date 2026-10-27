import {
  type AlignmentModel,
  BUILTIN_ALIGNMENT_MODEL,
  RECOMMENDED_ALIGNMENT_MODEL,
  loadAlignmentModels,
} from "@/audio/alignment/hubertfa/model-manifest";
import { settingEntry } from "@/stores/settings-catalog";
import { useSettingsStore } from "@/stores/settings";
import { SegmentedControl, type SegmentedOption } from "@/ui/segmented-control";
import { Select, type SelectOption } from "@/ui/select";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type ModelOrder = "listed" | "name";

// -- Constants -----------------------------------------------------------------

const ALL_LANGUAGES = "all";
const BUILTIN_OPTION: SelectOption = { value: BUILTIN_ALIGNMENT_MODEL.id, label: BUILTIN_ALIGNMENT_MODEL.label };
const ORDER_OPTIONS: SegmentedOption<ModelOrder>[] = [
  { value: "listed", label: "Listed" },
  { value: "name", label: "A-Z" },
];
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });
// Run and step numbers sort as numbers, so "step 5000" comes after "step 900".
const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

// -- Helpers -------------------------------------------------------------------

const languageName = (code: string) => LANGUAGE_NAMES.of(code) ?? code;

// Tabs only help when the checkpoints cover different languages.
function languageTabs(models: readonly AlignmentModel[]): SegmentedOption<string>[] {
  const codes = [...new Set(models.flatMap((m) => m.languages))];
  const differ = models.some((m) => m.languages.length !== codes.length);
  if (!differ) return [];
  return [{ value: ALL_LANGUAGES, label: "All" }, ...codes.map((code) => ({ value: code, label: languageName(code) }))];
}

// The built-in model stays first, as the one to compare the others against.
function visibleModels(models: readonly AlignmentModel[], language: string, order: ModelOrder): AlignmentModel[] {
  const [builtin, ...rest] = models;
  const shown = language === ALL_LANGUAGES ? rest : rest.filter((m) => m.languages.includes(language));
  if (order === "name") shown.sort((a, b) => byName.compare(a.label, b.label));
  return builtin ? [builtin, ...shown] : shown;
}

function toOption(model: AlignmentModel): SelectOption {
  const languages = model.languages.map(languageName).join(", ");
  const detail = `~${formatWholeMegabytes(model.approxBytes)} · ${languages}`;
  return { value: model.id, label: model.label, detail, ...(model.recommended ? { badge: "Recommended" } : {}) };
}

// What the picker shows as chosen. Once the list loads, a saved model that left
// the manifest, or Recommended with nothing recommended, shows as the built-in
// model auto-align falls back to.
function shownValue(models: readonly AlignmentModel[] | undefined, stored: string): string {
  if (!models) return stored;
  if (stored === RECOMMENDED_ALIGNMENT_MODEL) {
    return models.some((m) => m.recommended) ? stored : BUILTIN_ALIGNMENT_MODEL.id;
  }
  return models.some((m) => m.id === stored) ? stored : BUILTIN_ALIGNMENT_MODEL.id;
}

// "Recommended" follows the manifest: it names the model it currently means.
function recommendedOption(models: readonly AlignmentModel[]): SelectOption[] {
  const model = models.find((m) => m.recommended);
  return model ? [{ value: RECOMMENDED_ALIGNMENT_MODEL, label: "Recommended", detail: `Uses ${model.label}` }] : [];
}

// -- Component -----------------------------------------------------------------

// The choices come from the hosted manifest, which loads once per page and is
// shared with auto-align, so the query neither refetches nor cancels it.
const AlignmentModelSetting: React.FC = () => {
  const stored = useSettingsStore((s) => s.alignmentModelId);
  const set = useSettingsStore((s) => s.set);
  const [language, setLanguage] = useState(ALL_LANGUAGES);
  const [order, setOrder] = useState<ModelOrder>("listed");
  const { data: models } = useQuery({
    queryKey: ["alignment-models"],
    queryFn: loadAlignmentModels,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });

  const all = models ?? [];
  const tabs = languageTabs(all);
  const activeLanguage = tabs.some((t) => t.value === language) ? language : ALL_LANGUAGES;
  const options =
    all.length > 0
      ? [...recommendedOption(all), ...visibleModels(all, activeLanguage, order).map(toOption)]
      : [BUILTIN_OPTION];
  const value = shownValue(models, stored);
  const pendingLabel = stored === RECOMMENDED_ALIGNMENT_MODEL ? "Recommended" : "Loading…";
  const pending = !models && stored !== BUILTIN_OPTION.value ? [{ value: stored, label: pendingLabel }] : [];
  // A language tab can filter the selected model out of the list; keep its name on the trigger.
  const selectedLabel = all.find((m) => m.id === value)?.label;

  const header = all.length > 2 && (
    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pt-2.5 pb-1 border-b border-(--divider)">
      {tabs.length > 0 && (
        <SegmentedControl
          size="sm"
          aria-label="Language"
          value={activeLanguage}
          options={tabs}
          onChange={setLanguage}
        />
      )}
      <SegmentedControl size="sm" aria-label="Order" value={order} options={ORDER_OPTIONS} onChange={setOrder} />
    </div>
  );

  return (
    <SettingRowLayout>
      <SettingText id="alignmentModelId" />
      <Select
        aria-label={settingEntry("alignmentModelId").label}
        value={value}
        onChange={(next) => set("alignmentModelId", next)}
        options={[...options, ...pending]}
        valueLabel={selectedLabel}
        header={header}
        className="h-9 max-w-56 pl-3 pr-[5px] rounded-xl border-transparent hover:border-transparent btn-raised [&>svg]:size-3.5"
      />
    </SettingRowLayout>
  );
};

// -- Exports -------------------------------------------------------------------

export { AlignmentModelSetting };
