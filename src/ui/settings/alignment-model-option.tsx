import type { AlignmentModel } from "@/audio/alignment/hubertfa/model-manifest";
import { coversLanguage } from "@/domain/alignment/language";
import { languageName } from "@/domain/project/language";
import { LanguageCoverage } from "@/ui/language-coverage";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface AlignmentModelOptionProps {
  model: AlignmentModel;
  detail: string;
  columns: readonly string[];
  song: string | null;
}

// -- Components ----------------------------------------------------------------

const AlignmentModelOption: React.FC<AlignmentModelOptionProps> = ({ model, detail, columns, song }) => {
  const missed = song && !coversLanguage(model.languages, song) ? song : null;
  return (
    <span className="flex flex-1 items-center gap-3 min-w-0">
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={cn("text-pretty", missed && "text-(--muted)")}>
          {model.label}
          {model.recommended && (
            <StatusChip tone="accent" className="ml-1.5 align-[1px]">
              Recommended
            </StatusChip>
          )}
        </span>
        {missed ? (
          <span className="text-xs tabular-nums text-composer-warning">Doesn't cover {languageName(missed)}</span>
        ) : (
          <span className="text-xs tabular-nums text-(--muted)">{detail}</span>
        )}
      </span>
      <LanguageCoverage columns={columns} covered={model.languages} song={song} dimmed={missed !== null} />
    </span>
  );
};

// -- Exports -------------------------------------------------------------------

export { AlignmentModelOption };
