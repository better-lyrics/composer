import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { RuleCard } from "@/best-practices/rule-card";

// -- Components ----------------------------------------------------------------

const RuleList: React.FC = () => (
  <div className="flex flex-col gap-8">
    {BEST_PRACTICE_GROUPS.map((group) => (
      <section key={group.id} aria-labelledby={`best-practice-${group.id}`} className="flex flex-col gap-2.5">
        <h3 id={`best-practice-${group.id}`} className="text-[13px] font-bold tracking-[-0.01em] select-none">
          {group.label}
        </h3>
        {group.rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </section>
    ))}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { RuleList };
