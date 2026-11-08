import type { UnisonConfidence } from "@/lib/unison/api-types";
import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface ConfidenceMeterProps {
  confidence: UnisonConfidence;
  label?: "long" | "short";
}

// -- Constants -----------------------------------------------------------------

const LIT_BARS: Record<UnisonConfidence, number> = { low: 1, medium: 2, high: 3 };
const CONFIDENCE_LABELS: Record<UnisonConfidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};
const SHORT_CONFIDENCE_LABELS: Record<UnisonConfidence, string> = { low: "Low", medium: "Medium", high: "High" };
const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3"] as const;

// -- Component -----------------------------------------------------------------

const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ confidence, label }) => {
  const lit = LIT_BARS[confidence];
  const litColor = confidence === "low" ? "bg-composer-warning" : "bg-composer-positive";
  return (
    <span
      role="img"
      aria-label={CONFIDENCE_LABELS[confidence]}
      className="inline-flex items-center gap-1.5 text-[13px] text-(--label) whitespace-nowrap select-none"
    >
      <span aria-hidden="true" className="inline-flex h-3 items-end gap-[2px]">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className={cn("w-[3px] rounded-[1px]", height, index < lit ? litColor : "bg-(--layer-3)")}
          />
        ))}
      </span>
      {label && (
        <span aria-hidden="true">
          {label === "long" ? CONFIDENCE_LABELS[confidence] : SHORT_CONFIDENCE_LABELS[confidence]}
        </span>
      )}
    </span>
  );
};

// -- Exports -------------------------------------------------------------------

export { ConfidenceMeter };
