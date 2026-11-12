import {
  attachSharedCopiesChip,
  sharedCopiesHintSnapshot,
  subscribeSharedCopiesHint,
} from "@/views/timeline/shared-copies-hint";
import { FloatingChip } from "@/ui/floating-chip";
import { IconLink } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// -- Constants ----------------------------------------------------------------

const noLabel = () => null;

// -- Components ---------------------------------------------------------------

const SharedCopiesChip: React.FC = () => {
  const label = useSyncExternalStore(subscribeSharedCopiesHint, sharedCopiesHintSnapshot, noLabel);
  if (label === null || typeof document === "undefined") return null;
  return createPortal(
    <FloatingChip
      ref={attachSharedCopiesChip}
      role="status"
      icon={<IconLink className="size-3.5 text-composer-accent-text" stroke={2} />}
      className="top-0 left-0 font-medium"
    >
      {label}
    </FloatingChip>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { SharedCopiesChip };
