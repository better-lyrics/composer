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

// -- Helpers -------------------------------------------------------------------

function cellClass(isCovered: boolean, isSong: boolean): string {
  if (!isCovered) return "text-composer-text-faint shadow-[inset_0_0_0_1px_var(--divider)]";
  if (isSong) {
    return "bg-composer-accent/20 text-composer-accent-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-composer-accent)_45%,transparent)]";
  }
  return "bg-(--layer-2) text-(--label)";
}

// -- Components ----------------------------------------------------------------

// One fixed column per language, so the cells line up from row to row.
const LanguageCoverage: React.FC<LanguageCoverageProps> = ({ columns, covered, song, dimmed }) => (
  <span
    role="img"
    aria-label={`Covers ${covered.map(languageName).join(", ")}`}
    className={cn("ms-auto grid shrink-0 grid-flow-col auto-cols-[26px] gap-[3px]", dimmed && "opacity-60")}
  >
    {columns.map((code) => {
      const isCovered = coversLanguage(covered, code);
      return (
        <span
          key={code}
          aria-hidden="true"
          className={cn(
            "inline-flex h-[18px] items-center justify-center rounded-[5px] font-mono text-[10px] font-semibold",
            cellClass(isCovered, code === song),
          )}
        >
          {isCovered ? code.toUpperCase() : "·"}
        </span>
      );
    })}
  </span>
);

const CoverageCodes: React.FC<{ covered: readonly string[] }> = ({ covered }) => (
  <span className="shrink-0 font-mono text-[10px] font-semibold tracking-[0.04em] text-(--muted)">
    {covered.map((code) => code.toUpperCase()).join(" ")}
  </span>
);

// -- Exports -------------------------------------------------------------------

export { CoverageCodes, LanguageCoverage };
