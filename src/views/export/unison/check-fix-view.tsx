import type { CheckField, CheckFix } from "@/domain/unison/submit-checks";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { revealCheckTarget } from "@/views/export/unison/check-target";
import { LineIssueRows } from "@/views/export/unison/line-issue-rows";

// -- Interfaces ----------------------------------------------------------------

interface CheckFixActions {
  reviewInTimeline: () => void;
  regenerate: () => void;
}

interface CheckFixViewProps extends CheckFixActions {
  fix: CheckFix;
}

type FixAction = Extract<CheckFix, { kind: "action" }>["action"];

// -- Constants -----------------------------------------------------------------

const FIELD_LABELS: Record<CheckField, string> = {
  title: "Add title",
  artist: "Add artist",
  isrc: "Fix ISRC",
  language: "Fix language",
};

const ACTION_LABELS: Record<FixAction, string> = {
  "load-audio": "Load audio",
  "review-alignment": "Review in Timeline",
  regenerate: "Regenerate",
};

// -- Functions -----------------------------------------------------------------

function runAction(action: FixAction, actions: CheckFixActions): void {
  if (action === "load-audio") useProjectStore.getState().setActiveTab("import");
  else if (action === "review-alignment") actions.reviewInTimeline();
  else actions.regenerate();
}

// -- Components ----------------------------------------------------------------

const FixButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <span>
    <Button size="sm" variant="secondary" onClick={onClick} className="mt-1">
      {label}
    </Button>
  </span>
);

const CheckFixView: React.FC<CheckFixViewProps> = ({ fix, ...actions }) => {
  switch (fix.kind) {
    case "lines":
      return <LineIssueRows key={fix.issues.length} issues={fix.issues} />;
    case "field":
      return <FixButton label={FIELD_LABELS[fix.field]} onClick={() => revealCheckTarget(fix.field)} />;
    case "video":
      return <FixButton label="Choose video" onClick={() => revealCheckTarget("video")} />;
    case "action":
      return <FixButton label={ACTION_LABELS[fix.action]} onClick={() => runAction(fix.action, actions)} />;
    case "none":
      return null;
  }
};

// -- Exports -------------------------------------------------------------------

export { CheckFixView };
export type { CheckFixActions };
