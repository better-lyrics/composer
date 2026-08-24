import { groupAnchorId } from "@/best-practices/anchors";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { RuleCard } from "@/best-practices/rule-card";

// -- Components ----------------------------------------------------------------

const RuleList: React.FC = () => (
  <div className="flex flex-col gap-8">
    {BEST_PRACTICE_GROUPS.map((group) => (
      <section key={group.id} aria-labelledby={groupAnchorId(group.id)}>
        <h3
          id={groupAnchorId(group.id)}
          className="mb-3.5 scroll-mt-3.5 text-[13px] font-bold tracking-[-0.01em] select-none"
        >
          {group.label}
        </h3>
        <div className="flex flex-col gap-2.5">
          {group.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </section>
    ))}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { RuleList };
