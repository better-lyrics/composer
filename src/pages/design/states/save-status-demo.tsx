import type { SaveStatus } from "@/lib/save-status";
import { DesignSection } from "@/pages/design/design-section";
import { StateCell } from "@/pages/design/state-cell";
import { type StateChip, StateChips } from "@/pages/design/state-chips";
import { Button } from "@/ui/button";
import { SAVE_STATUS_COPY, SaveStatusIcon } from "@/ui/projects/save-status-label";
import { useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const SAVE_DURATION_MS = 900;

// -- Components ----------------------------------------------------------------

const SaveStatusDemo: React.FC = () => {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const enter = (next: SaveStatus) => {
    clearTimeout(timerRef.current);
    setStatus(next);
  };

  const saveNow = () => {
    enter("saving");
    timerRef.current = setTimeout(() => setStatus("saved"), SAVE_DURATION_MS);
  };

  const states: readonly StateChip<SaveStatus>[] = [
    { id: "saved", label: SAVE_STATUS_COPY.saved, enter: () => enter("saved") },
    { id: "saving", label: SAVE_STATUS_COPY.saving, enter: () => enter("saving") },
    { id: "failed", label: SAVE_STATUS_COPY.failed, enter: () => enter("failed") },
  ];
  const word = status === "failed" ? null : SAVE_STATUS_COPY[status];

  return (
    <DesignSection
      id="save-status"
      note="Sits beside the project title. A check means saved and a spinner means saving. A failed save shows a warning in words, since you need to notice it."
    >
      <StateChips label="Save states" states={states} current={status} />
      <StateCell label="Beside the project title">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-composer-text-faint select-none">
            <SaveStatusIcon status={status} />
            {word}
          </span>
          <Button size="sm" variant="secondary" onClick={saveNow}>
            Save now
          </Button>
        </div>
      </StateCell>
    </DesignSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { SaveStatusDemo };
