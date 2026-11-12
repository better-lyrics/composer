import {
  attachSharedCopiesChip,
  sharedCopiesHintSnapshot,
  subscribeSharedCopiesHint,
} from "@/views/timeline/shared-copies-hint";
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
    <div
      ref={attachSharedCopiesChip}
      role="status"
      className="surface-floating layer-floating pointer-events-none fixed top-0 left-0 flex h-6 items-center gap-1.5 rounded-md pr-2.5 pl-2 text-xs whitespace-nowrap text-(--label) select-none"
    >
      <IconLink className="size-3.5 text-composer-accent-text" stroke={2} />
      {label}
    </div>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { SharedCopiesChip };
