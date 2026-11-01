import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";

// -- Constants ----------------------------------------------------------------

// The Song details panel uses 32px fields under a small label.
const DETAILS_FIELD_STYLES = cn(INPUT_STYLES, "h-8 py-0");
const DETAILS_LABEL_STYLES = "text-xs font-medium text-(--label) select-none";

// -- Exports ------------------------------------------------------------------

export { DETAILS_FIELD_STYLES, DETAILS_LABEL_STYLES };
