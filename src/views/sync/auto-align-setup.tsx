import { pickAlignmentModel } from "@/audio/alignment/hubertfa/model-manifest";
import { VOCAL_MODEL_APPROX_BYTES } from "@/audio/separation/model-registry";
import { coversLanguage } from "@/domain/alignment/language";
import { hasMainLyrics, isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { languageName } from "@/domain/project/language";
import { useAlignmentModels } from "@/hooks/useAlignmentModels";
import { useSongLanguage } from "@/hooks/useSongLanguage";
import { useAlignmentStore } from "@/stores/alignment";
import { countAlignableLines } from "@/stores/alignment-plan";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { useUIStore } from "@/stores/ui";
import { PopActions, PopButton, PopGroup, PopHead, PopRow, PopText } from "@/ui/pop-layout";
import { StatusChip } from "@/ui/status-chip";
import { formatWholeMegabytes } from "@/utils/format-file-size";
import { percent } from "@/utils/percent";
import { pluralize } from "@/utils/pluralize";
import {
  IconCheck,
  IconLanguage,
  IconMicrophone2,
  IconRefresh,
  IconTimelineEventText,
  IconWand,
} from "@tabler/icons-react";
import { useMemo } from "react";

// -- Interfaces ----------------------------------------------------------------

interface LineCounts {
  lineTimed: number;
  wordTimed: number;
  untimed: number;
}

// -- Components ----------------------------------------------------------------

const LineTimingRow: React.FC<{ counts: LineCounts }> = ({ counts }) => {
  const granularity = useProjectStore((s) => s.granularity);
  const timed = counts.lineTimed + counts.wordTimed;
  const total = timed + counts.untimed;
  if (timed === 0) {
    return (
      <PopRow label="Line timing" icon={IconTimelineEventText} hint="Tap each line's start and end. Rough is fine.">
        {granularity === "word" && (
          <PopButton onClick={() => useProjectStore.getState().setGranularity("line")}>Line mode</PopButton>
        )}
      </PopRow>
    );
  }
  const hint = counts.untimed > 0 ? `${pluralize(timed, "line")} timed, ${counts.untimed} not yet` : "All lines timed";
  return (
    <PopRow label="Line timing" icon={IconTimelineEventText} hint={hint}>
      <StatusChip tone="positive" icon={IconCheck}>
        {timed} / {total}
      </StatusChip>
    </PopRow>
  );
};

const VocalsRow: React.FC = () => {
  const status = useSeparationStore((s) => s.status);
  const progress = useSeparationStore((s) => s.progress);
  const hasVocals = useSeparationStore((s) => !!s.stemUrls.vocals);
  const variant = useSettingsStore((s) => s.vocalModelVariant);
  const separating = status === "downloading" || status === "processing";
  if (hasVocals) {
    return (
      <PopRow label="Separated vocals" icon={IconMicrophone2} hint="Ready">
        <StatusChip tone="positive" icon={IconCheck}>
          Done
        </StatusChip>
      </PopRow>
    );
  }
  const hint = separating
    ? `Separating… ${percent(progress.loaded, progress.total)}%`
    : `Uses the vocal model, ${formatWholeMegabytes(VOCAL_MODEL_APPROX_BYTES[variant])} once.`;
  return (
    <PopRow label="Separated vocals" icon={IconMicrophone2} hint={hint}>
      {!separating && <PopButton onClick={() => void useSeparationStore.getState().separate()}>Separate</PopButton>}
    </PopRow>
  );
};

const ModelLanguageRow: React.FC = () => {
  const song = useSongLanguage();
  const modelId = useSettingsStore((s) => s.alignmentModelId);
  const models = useAlignmentModels();
  const model = models ? pickAlignmentModel(models, modelId) : null;
  if (!song || !model || coversLanguage(model.languages, song)) return null;
  const language = languageName(song);
  return (
    <PopRow
      label={`Model covers ${language}`}
      icon={IconLanguage}
      hint={<span className="text-composer-warning">{`${model.label} doesn't cover ${language}`}</span>}
    >
      <PopButton onClick={() => useUIStore.getState().openSettings({ target: { setting: "alignmentModelId" } })}>
        Change
      </PopButton>
    </PopRow>
  );
};

const SetupIntro: React.FC = () => {
  const modelCached = useAlignmentStore((s) => s.modelCached);
  const sizeBytes = useAlignmentStore((s) => s.modelSizeBytes);
  const download = !modelCached && sizeBytes ? ` Downloads ${formatWholeMegabytes(sizeBytes)} on the first run.` : "";
  return (
    <PopText className="mt-1.5">
      Times each word from the separated vocals, guided by your line timing. Works for English, Mandarin and Japanese.
      {download}
    </PopText>
  );
};

// What's still needed before a whole-song run, and the buttons that start one.
const AutoAlignSetup: React.FC<{ run: (realign: boolean) => void }> = ({ run }) => {
  const lines = useProjectStore((s) => s.lines);
  const hasVocals = useSeparationStore((s) => !!s.stemUrls.vocals);
  const counts = useMemo<LineCounts>(() => {
    const { lineTimed, wordTimed } = countAlignableLines(lines);
    const untimed = lines.filter((l) => hasMainLyrics(l) && !isWordSynced(l) && !isLineSynced(l)).length;
    return { lineTimed, wordTimed, untimed };
  }, [lines]);
  const timed = counts.lineTimed + counts.wordTimed;

  return (
    <>
      <PopHead title="Auto-align words" />
      <SetupIntro />
      <PopGroup label="Needs">
        <LineTimingRow counts={counts} />
        <VocalsRow />
        <ModelLanguageRow />
      </PopGroup>
      <PopActions split className="mt-4">
        {counts.wordTimed > 0 ? (
          <PopButton
            variant="ghost"
            icon={IconRefresh}
            disabled={!hasVocals}
            onClick={() => run(true)}
            title="Redo word timing for every timed line, using each line's current span as the guide"
          >
            {`Re-align all ${pluralize(timed, "line")}`}
          </PopButton>
        ) : (
          <span />
        )}
        <PopButton
          variant="primary"
          icon={IconWand}
          disabled={counts.lineTimed === 0 || !hasVocals}
          onClick={() => run(false)}
        >
          {counts.lineTimed > 0 ? `Align ${pluralize(counts.lineTimed, "line")}` : "Align words"}
        </PopButton>
      </PopActions>
    </>
  );
};

// -- Exports -------------------------------------------------------------------

export { AutoAlignSetup };
