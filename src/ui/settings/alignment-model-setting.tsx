import {
  type AlignmentModel,
  BUILTIN_ALIGNMENT_MODEL,
  pickAlignmentModel,
} from "@/audio/alignment/hubertfa/model-manifest";
import { coverageColumns, coversLanguage } from "@/domain/alignment/language";
import { languageName } from "@/domain/project/language";
import { useAlignmentModels } from "@/hooks/useAlignmentModels";
import { useSongLanguage } from "@/hooks/useSongLanguage";
import { settingEntry } from "@/stores/settings-catalog";
import { useSettingsStore } from "@/stores/settings";
import { CoverageCodes } from "@/ui/language-coverage";
import { Select, type SelectOption } from "@/ui/select";
import { AlignmentModelOption } from "@/ui/settings/alignment-model-option";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { StatusChip } from "@/ui/status-chip";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Constants -----------------------------------------------------------------

const BUILTIN_OPTION: SelectOption = { value: BUILTIN_ALIGNMENT_MODEL.id, label: BUILTIN_ALIGNMENT_MODEL.label };

// -- Helpers -------------------------------------------------------------------

// Recommended first, then the models that cover the song, each group in manifest order.
function orderedModels(models: readonly AlignmentModel[], song: string | null): AlignmentModel[] {
  const rank = (model: AlignmentModel) => {
    if (model.recommended) return 0;
    return song && coversLanguage(model.languages, song) ? 1 : 2;
  };
  return models.toSorted((a, b) => rank(a) - rank(b));
}

function loadingLanguages(value: string): readonly string[] | undefined {
  return value === BUILTIN_ALIGNMENT_MODEL.id ? BUILTIN_ALIGNMENT_MODEL.languages : undefined;
}

// -- Components ----------------------------------------------------------------

const SongLanguageHeader: React.FC<{ song: string }> = ({ song }) => (
  <div className="px-3.5 pt-2.5 pb-2 border-b border-(--divider) text-xs text-(--muted)">
    This song is in <span className="text-composer-text">{languageName(song)}</span>
  </div>
);

const TriggerCoverage: React.FC<{ languages: readonly string[]; song: string | null }> = ({ languages, song }) =>
  song && !coversLanguage(languages, song) ? (
    <StatusChip tone="warning" icon={IconAlertTriangle}>
      No {song.toUpperCase()}
    </StatusChip>
  ) : (
    <CoverageCodes covered={languages} />
  );

const AlignmentModelSetting: React.FC = () => {
  const stored = useSettingsStore((s) => s.alignmentModelId);
  const set = useSettingsStore((s) => s.set);
  const song = useSongLanguage();
  const models = useAlignmentModels();

  const ordered = models ? orderedModels(models, song) : [];
  const columns = coverageColumns(
    ordered.map((m) => m.languages),
    song,
  );
  const byId = new Map(ordered.map((m) => [m.id, m]));
  const pending = !models && stored !== BUILTIN_OPTION.value ? [{ value: stored, label: "Loading…" }] : [];
  const options: SelectOption[] =
    ordered.length > 0
      ? ordered.map((m) => ({ value: m.id, label: m.label, detail: formatWholeMegabytes(m.approxBytes) }))
      : [BUILTIN_OPTION, ...pending];
  const value = models ? (pickAlignmentModel(models, stored)?.id ?? BUILTIN_OPTION.value) : stored;
  const selectedLanguages = byId.get(value)?.languages ?? loadingLanguages(value);

  const renderOption = (option: SelectOption) => {
    const model = byId.get(option.value);
    if (!model) return <span className="truncate">{option.label}</span>;
    return <AlignmentModelOption model={model} detail={option.detail ?? ""} columns={columns} song={song} />;
  };

  return (
    <SettingRowLayout>
      <SettingText id="alignmentModelId" />
      <Select
        aria-label={settingEntry("alignmentModelId").label}
        value={value}
        onChange={(next) => set("alignmentModelId", next)}
        options={options}
        renderOption={renderOption}
        header={song && <SongLanguageHeader song={song} />}
        triggerAdornment={selectedLanguages && <TriggerCoverage languages={selectedLanguages} song={song} />}
        className="h-9 max-w-72 pl-3 pr-[5px] rounded-xl border-transparent hover:border-transparent btn-raised [&>svg]:size-3.5"
      />
    </SettingRowLayout>
  );
};

// -- Exports -------------------------------------------------------------------

export { AlignmentModelSetting };
