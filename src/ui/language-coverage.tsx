import { coversLanguage } from "@/domain/alignment/language";
import { languageName } from "@/domain/project/language";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface LanguageCoverageProps {
  columns: readonly string[];
  covered: readonly string[];
  song: string | null;
  dimmed?: boolean;
}

// -- Constants -----------------------------------------------------------------

// A picker row has room for this many cells beside its label, and its trigger for this many codes.
const MAX_ALIGNED_LANGUAGES = 4;

// -- Helpers -------------------------------------------------------------------

function cellClass(isCovered: boolean, isSong: boolean): string {
  if (!isCovered) return "text-composer-text-faint shadow-[inset_0_0_0_1px_var(--divider)]";
  if (isSong) {
    return "bg-composer-accent/20 text-composer-accent-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-accent)_45%,transparent)]";
  }
  return "bg-(--layer-2) text-(--label)";
}

/** Whether there are too many languages for one cell each beside a label. */
function stacksCoverage(languages: readonly string[]): boolean {
  return languages.length > MAX_ALIGNED_LANGUAGES;
}

// -- Components ----------------------------------------------------------------

// One fixed column per language, so the cells line up from row to row. Past what fits beside a label, the row
// lists only the languages it covers and wraps them.
const LanguageCoverage: React.FC<LanguageCoverageProps> = ({ columns, covered, song, dimmed }) => {
  const stacked = stacksCoverage(columns);
  const cells = stacked ? columns.filter((code) => coversLanguage(covered, code)) : columns;
  return (
    <span
      role="img"
      aria-label={`Covers ${covered.map(languageName).join(", ")}`}
      className={cn("flex gap-[3px]", stacked ? "flex-wrap" : "ms-auto shrink-0", dimmed && "opacity-60")}
    >
      {cells.map((code) => {
        const isCovered = coversLanguage(covered, code);
        return (
          <span
            key={code}
            aria-hidden="true"
            className={cn(
              "inline-flex h-[18px] w-[26px] items-center justify-center rounded-[5px] font-mono text-[10px] font-semibold",
              cellClass(isCovered, code === song),
            )}
          >
            {isCovered ? code.toUpperCase() : "·"}
          </span>
        );
      })}
    </span>
  );
};

const CoverageCodes: React.FC<{ covered: readonly string[] }> = ({ covered }) => (
  <span className="shrink-0 font-mono text-[10px] font-semibold tracking-[0.04em] text-(--muted)">
    {stacksCoverage(covered) ? `${covered.length} LANGUAGES` : covered.map((code) => code.toUpperCase()).join(" ")}
  </span>
);

// -- Exports -------------------------------------------------------------------

export { CoverageCodes, LanguageCoverage, stacksCoverage };
