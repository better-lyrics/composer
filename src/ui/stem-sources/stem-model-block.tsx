import { VOCAL_MODEL_APPROX_BYTES } from "@/audio/separation/model-registry";
import type { SeparationError } from "@/audio/separation/types";
import { STEM_SLOTS } from "@/domain/stems/stem-slot";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { ModelProgress } from "@/ui/model-progress";
import { STEM_LABELS } from "@/ui/stem-labels";
import { COMPACT_BUTTON } from "@/ui/stem-sources/compact-button";
import { separationErrorCopy } from "@/ui/stem-sources/separation-error-copy";
import { StemNotice } from "@/ui/stem-sources/stem-notice";
import { formatMegabytesOf, formatWholeMegabytes } from "@/utils/format-file-size";
import { percent } from "@/utils/percent";

// -- Components ---------------------------------------------------------------

const Separator: React.FC = () => <div className="h-px my-2.5 bg-(--divider)" />;

const ModelError: React.FC<{ error: SeparationError }> = ({ error }) => {
  const { title, next } = separationErrorCopy(error.code);
  const { retry, dismissError } = useSeparationStore.getState();
  return (
    <StemNotice
      tone="negative"
      className="-mx-1.5"
      actions={
        <>
          <Button size="sm" variant="ghost" className={COMPACT_BUTTON} onClick={dismissError}>
            Dismiss
          </Button>
          <Button size="sm" variant="primary" className={COMPACT_BUTTON} onClick={() => void retry()}>
            Try again
          </Button>
        </>
      }
    >
      <p className="text-[13px] font-medium leading-[1.35] text-composer-text text-pretty">{title}</p>
      <p className="mt-0.5 text-xs leading-[1.45] text-(--label) text-pretty">{next}</p>
      <p className="mt-1.5 text-xs leading-[1.45] text-(--muted) wrap-break-word select-text cursor-text">
        {error.message}
      </p>
    </StemNotice>
  );
};

const StemModelBlock: React.FC = () => {
  const status = useSeparationStore((s) => s.status);
  const progress = useSeparationStore((s) => s.progress);
  const error = useSeparationStore((s) => s.error);
  const stemUrls = useSeparationStore((s) => s.stemUrls);
  const stemOrigins = useSeparationStore((s) => s.stemOrigins);
  const modelCached = useSeparationStore((s) => s.modelCached);
  const hostingConfigured = useSeparationStore((s) => s.hostingConfigured);
  const approxBytes = useSettingsStore((s) => VOCAL_MODEL_APPROX_BYTES[s.vocalModelVariant]);

  const emptySlots = STEM_SLOTS.filter((slot) => stemUrls[slot] === undefined);
  const fills = emptySlots.map((slot) => STEM_LABELS[slot].toLowerCase()).join(" and ");
  if (!hostingConfigured) return null;

  if (status === "error" && error) {
    return (
      <>
        <Separator />
        <ModelError error={error} />
      </>
    );
  }

  if (status === "downloading" || status === "processing") {
    const downloading = status === "downloading";
    const separating = fills ? `Separating ${fills}…` : "Separating…";
    const keepsImported = STEM_SLOTS.some((slot) => stemOrigins[slot] === "imported");
    const pct = percent(progress.loaded, progress.total);
    return (
      <>
        <Separator />
        <div className="-mx-2">
          <ModelProgress
            title={downloading ? "Downloading model…" : separating}
            meta={downloading ? formatMegabytesOf(progress.loaded, progress.total || approxBytes) : `${pct}%`}
            pct={pct}
            note={keepsImported && "Your imported stems stay as they are."}
            onCancel={() => useSeparationStore.getState().cancel()}
          />
        </div>
      </>
    );
  }
  if (emptySlots.length === 0) return null;

  return (
    <>
      <Separator />
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-composer-text">Separate with the vocal model</p>
          <p className="mt-0.5 text-xs leading-[1.45] text-(--muted) text-pretty">
            Makes the {fills} from this song.
            {!modelCached && ` Needs a one-time ${formatWholeMegabytes(approxBytes)} download.`}
          </p>
        </div>
        <Button
          size="sm"
          variant={emptySlots.length === STEM_SLOTS.length ? "primary" : "secondary"}
          className="shrink-0"
          onClick={() => void useSeparationStore.getState().separate()}
        >
          Separate
        </Button>
      </div>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemModelBlock };
