import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { RuleList } from "@/best-practices/rule-list";
import { PROSE } from "@/ui/help-sections/shared";

// -- Best practices -----------------------------------------------------------

const BestPracticesSection: React.FC = () => (
  <div className="flex flex-col gap-4">
    <p className={`${PROSE} max-w-[68ch]`}>
      None of this is enforced. TTML will take a file that breaks every rule here and Better Lyrics will render it
      without complaint. What it changes is whether people enjoy reading along, or find the file quietly annoying in a
      way they can't name.
    </p>

    <ul aria-label="Rule groups" className="flex flex-wrap gap-1.5 select-none">
      {BEST_PRACTICE_GROUPS.map((group) => (
        <li
          key={group.id}
          className="rounded-full border border-composer-border bg-composer-input px-3 py-1 text-xs text-composer-text-secondary"
        >
          {group.label}
        </li>
      ))}
    </ul>

    <RuleList />
  </div>
);

// -- Exports ------------------------------------------------------------------

export { BestPracticesSection };
