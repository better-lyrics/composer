import { useReducedMotion } from "motion/react";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import type { RuleGroup } from "@/best-practices/model";
import { groupAnchorId, RuleList } from "@/best-practices/rule-list";
import { PROSE } from "@/ui/typography";

// -- Interfaces ---------------------------------------------------------------

interface GroupChipProps {
  group: RuleGroup;
  behavior: ScrollBehavior;
}

// -- Components ---------------------------------------------------------------

const GroupChip: React.FC<GroupChipProps> = ({ group, behavior }) => (
  <button
    type="button"
    onClick={() => document.getElementById(groupAnchorId(group.id))?.scrollIntoView({ block: "start", behavior })}
    className="cursor-pointer rounded-full border border-composer-border bg-composer-input px-3 py-1 text-xs text-composer-text-secondary transition-colors hover:border-composer-accent hover:text-composer-text focus:border-composer-accent focus:outline-none"
  >
    {group.label}
  </button>
);

// -- Best practices -----------------------------------------------------------

const BestPracticesSection: React.FC = () => {
  const behavior: ScrollBehavior = useReducedMotion() ? "auto" : "smooth";

  return (
    <div className="flex flex-col gap-4">
      <p className={`${PROSE} max-w-[68ch]`}>
        Nothing here is enforced. Break every rule and the file still validates, and Better Lyrics still renders it. It
        just reads worse: lines that outstay the vocal, backing parts you mistake for the lead.
      </p>

      <ul aria-label="Rule groups" className="flex flex-wrap gap-1.5 select-none">
        {BEST_PRACTICE_GROUPS.map((group) => (
          <li key={group.id}>
            <GroupChip group={group} behavior={behavior} />
          </li>
        ))}
      </ul>

      <RuleList />
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BestPracticesSection };
