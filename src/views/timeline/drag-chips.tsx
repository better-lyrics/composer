import { BoundaryModeChip } from "@/views/timeline/boundary-mode-chip";
import { SharedCopiesChip } from "@/views/timeline/shared-copies-chip";

// -- Components ---------------------------------------------------------------

const DragChips: React.FC = () => (
  <>
    <BoundaryModeChip />
    <SharedCopiesChip />
  </>
);

// -- Exports ------------------------------------------------------------------

export { DragChips };
