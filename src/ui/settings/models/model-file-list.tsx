import { type Icon, IconMetronome, IconMicrophone2, IconWand } from "@tabler/icons-react";
import { groupModelFiles, type ModelFile, type ModelKind, modelFilesBytes } from "@/domain/models/model-files";
import { useStorageReport } from "@/hooks/useStorageReport";
import { knownModelUrls, modelKindBusy, removeModelFiles, vocalVariantOfFile } from "@/lib/model-files";
import { useAlignmentStore } from "@/stores/alignment";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore, type VocalModelVariant } from "@/stores/settings";
import { type SettingId, settingEntry } from "@/stores/settings-catalog";
import { ModelFileRow } from "@/ui/settings/models/model-file-row";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { VOCAL_MODEL_LABELS } from "@/ui/settings/vocal-model-setting";
import { toast } from "@/utils/toast";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ModelFiles]";

const KIND_DETAILS: Record<ModelKind, { settingId: SettingId; icon: Icon }> = {
  vocal: { settingId: "vocalModelFiles", icon: IconMicrophone2 },
  alignment: { settingId: "alignmentModelFiles", icon: IconWand },
  beat: { settingId: "beatModelFiles", icon: IconMetronome },
};

// -- Helpers ------------------------------------------------------------------

function removeFiles(kind: ModelKind, onlyUrls?: readonly string[]): void {
  removeModelFiles(kind, onlyUrls).catch((error: unknown) => {
    console.error(LOG_PREFIX, `could not remove the ${kind} model files`, error);
    toast.error("Couldn't remove the model files");
  });
}

function useModelKindBusy(kind: ModelKind): boolean {
  useSeparationStore((state) => state.status);
  useAlignmentStore((state) => state.status);
  useBeatDetectionStore((state) => state.status);
  return modelKindBusy(kind);
}

// -- Components ---------------------------------------------------------------

// The RoFormer's graphs are one model, so they share a row.
function groupByVariant(files: readonly ModelFile[]): [VocalModelVariant | undefined, ModelFile[]][] {
  const groups = new Map<string, [VocalModelVariant | undefined, ModelFile[]]>();
  for (const file of files) {
    const variant = vocalVariantOfFile(file.url);
    const key = variant ?? file.url;
    const group = groups.get(key) ?? [variant, []];
    group[1].push(file);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const VocalModelRows: React.FC<{ files: readonly ModelFile[]; busy: boolean }> = ({ files, busy }) => {
  const selectedVariant = useSettingsStore((s) => s.vocalModelVariant);
  return groupByVariant(files).map(([variant, group]) => (
    <ModelFileRow
      key={group[0].url}
      icon={IconMicrophone2}
      label={variant === "roformer" ? `${VOCAL_MODEL_LABELS.roformer} model` : `${variant ?? "Vocal"} model file`}
      files={group}
      totalBytes={modelFilesBytes(group)}
      busy={busy}
      note={
        variant === selectedVariant
          ? "Downloaded"
          : `Downloaded. Not used while ${settingEntry("vocalModelVariant").label} is ${VOCAL_MODEL_LABELS[selectedVariant]}`
      }
      onRemove={() =>
        removeFiles(
          "vocal",
          group.map((file) => file.url),
        )
      }
    />
  ));
};

const ModelFileList: React.FC<{ kind: ModelKind }> = ({ kind }) => {
  const report = useStorageReport();
  const busy = useModelKindBusy(kind);
  const { settingId, icon } = KIND_DETAILS[kind];
  const files = report ? groupModelFiles(report.modelFiles, knownModelUrls())[kind] : [];

  return (
    <div className="flex flex-col gap-1 py-3">
      <SettingRowLayout className="py-0">
        <SettingText id={settingId} />
      </SettingRowLayout>
      {kind === "vocal" ? (
        <VocalModelRows files={files} busy={busy} />
      ) : (
        files.length > 0 && (
          <ModelFileRow
            icon={icon}
            label={settingEntry(settingId).label}
            files={files}
            totalBytes={modelFilesBytes(files)}
            busy={busy}
            onRemove={() => removeFiles(kind)}
          />
        )
      )}
    </div>
  );
};

const VocalModelFilesSetting: React.FC = () => <ModelFileList kind="vocal" />;
const AlignmentModelFilesSetting: React.FC = () => <ModelFileList kind="alignment" />;
const BeatModelFilesSetting: React.FC = () => <ModelFileList kind="beat" />;

// -- Exports ------------------------------------------------------------------

export { AlignmentModelFilesSetting, BeatModelFilesSetting, VocalModelFilesSetting };
