import { useAutoAlign } from "@/hooks/use-auto-align";
import { type AlignmentError, useAlignmentStore } from "@/stores/alignment";
import { useSettingsStore } from "@/stores/settings";
import { ModelErrorNotice } from "@/ui/model-error-notice";
import { ModelProgress } from "@/ui/model-progress";
import { PopBody } from "@/ui/pop-layout";
import { formatMegabytesOf } from "@/utils/format-file-size";
import { percent } from "@/utils/percent";
import { alignmentErrorCopy } from "@/ui/alignment-error-copy";
import { AutoAlignSetup } from "@/views/sync/auto-align-setup";
import { useEffect } from "react";

// -- Components ---------------------------------------------------------------

const AutoAlignError: React.FC<{ error: AlignmentError; onRetry: () => void }> = ({ error, onRetry }) => (
  <ModelErrorNotice
    {...alignmentErrorCopy(error.code)}
    message={error.message}
    onDismiss={() => useAlignmentStore.getState().dismissError()}
    onRetry={onRetry}
    className="rounded-lg"
  />
);

const AutoAlignProgress: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const status = useAlignmentStore((s) => s.status);
  const progress = useAlignmentStore((s) => s.progress);
  const modelCached = useAlignmentStore((s) => s.modelCached);
  const pct = percent(progress.done, progress.total);
  if (status === "downloading") {
    return (
      <ModelProgress
        title={modelCached ? "Loading alignment model…" : "Downloading alignment model…"}
        meta={progress.total > 0 ? formatMegabytesOf(progress.done, progress.total) : `${pct}%`}
        pct={pct}
        note="Only the first run downloads. Later runs start at once."
        onCancel={onCancel}
      />
    );
  }
  return (
    <ModelProgress
      title="Aligning words…"
      meta={`${progress.done} / ${progress.total}`}
      pct={pct}
      note="You can keep working while it runs."
      onCancel={onCancel}
    />
  );
};

// What auto-align still needs, its progress and its errors, shared by the Sync
// tab's popover and the Timeline's split button.
const AutoAlignPanel: React.FC = () => {
  const status = useAlignmentStore((s) => s.status);
  const error = useAlignmentStore((s) => s.error);
  const modelId = useSettingsStore((s) => s.alignmentModelId);
  const refreshModelCached = useAlignmentStore((s) => s.refreshModelCached);
  const { autoAlign, cancel, retry } = useAutoAlign();

  useEffect(() => {
    void refreshModelCached(modelId);
  }, [refreshModelCached, modelId]);

  const run = (realign: boolean) => void autoAlign(undefined, { allowDownload: true, realign, toastErrors: false });
  const busy = status === "downloading" || status === "running";

  return (
    <PopBody>
      {status === "error" && error && <AutoAlignError error={error} onRetry={retry} />}
      {busy && <AutoAlignProgress onCancel={cancel} />}
      {status === "idle" && <AutoAlignSetup run={run} />}
    </PopBody>
  );
};

// -- Exports ------------------------------------------------------------------

export { AutoAlignPanel };
