import { type ModelKind, groupModelFiles, modelFilesBytes } from "@/domain/models/model-files";
import { useStorageReport } from "@/hooks/useStorageReport";
import { knownModelUrls, modelKindBusy, removeModelFiles } from "@/lib/model-files";
import { useAlignmentStore } from "@/stores/alignment";
import { useBeatDetectionStore } from "@/stores/beat-detection";
import { type SettingId, settingEntry } from "@/stores/settings-catalog";
import { useSeparationStore } from "@/stores/separation";
import { ModelFileRow } from "@/ui/settings/models/model-file-row";
import { SettingRowLayout } from "@/ui/settings/setting-row-layout";
import { SettingText } from "@/ui/settings/setting-text";
import { type Icon, IconMetronome, IconMicrophone2, IconWand } from "@tabler/icons-react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ModelFiles]";

const KIND_DETAILS: Record<ModelKind, { settingId: SettingId; icon: Icon }> = {
  vocal: { settingId: "vocalModelFiles", icon: IconMicrophone2 },
  alignment: { settingId: "alignmentModelFiles", icon: IconWand },
  beat: { settingId: "beatModelFiles", icon: IconMetronome },
};

// -- Helpers ------------------------------------------------------------------

function removeKind(kind: ModelKind): void {
  removeModelFiles(kind).catch((error: unknown) => {
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
      {files.length > 0 && (
        <ModelFileRow
          icon={icon}
          label={settingEntry(settingId).label}
          files={files}
          totalBytes={modelFilesBytes(files)}
          busy={busy}
          onRemove={() => removeKind(kind)}
        />
      )}
    </div>
  );
};

const VocalModelFilesSetting: React.FC = () => <ModelFileList kind="vocal" />;
const AlignmentModelFilesSetting: React.FC = () => <ModelFileList kind="alignment" />;
const BeatModelFilesSetting: React.FC = () => <ModelFileList kind="beat" />;

// -- Exports ------------------------------------------------------------------

export { AlignmentModelFilesSetting, BeatModelFilesSetting, VocalModelFilesSetting };
