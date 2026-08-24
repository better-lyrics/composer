import { IconCheck, IconX } from "@tabler/icons-react";
import type { Rule } from "@/best-practices/model";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ExampleRowProps {
  kind: "wrong" | "right";
  children: React.ReactNode;
}

interface RuleCardProps {
  rule: Rule;
}

// -- Components ----------------------------------------------------------------

const ExampleRow: React.FC<ExampleRowProps> = ({ kind, children }) => {
  const isWrong = kind === "wrong";
  return (
    <div
      data-example-kind={kind}
      className={cn("flex gap-3 px-4 py-3.5", isWrong ? "bg-composer-negative/5" : "bg-composer-positive/5")}
    >
      {isWrong ? (
        <IconX aria-hidden size={14} className="mt-0.5 shrink-0 text-composer-negative" />
      ) : (
        <IconCheck aria-hidden size={14} className="mt-0.5 shrink-0 text-composer-positive" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[11px] text-composer-text-muted">{isWrong ? "Don't" : "Do"}</p>
        <div className={cn("select-text", isWrong && "opacity-60")}>{children}</div>
      </div>
    </div>
  );
};

const RuleCard: React.FC<RuleCardProps> = ({ rule }) => (
  <article className="flex flex-col gap-2 rounded-xl border border-composer-border bg-gradient-to-b from-white/[2.5%] to-transparent px-4.5 py-4 select-none">
    <h4 className="text-[13.5px] font-semibold tracking-[-0.01em] select-text">{rule.title}</h4>
    {rule.body.map((paragraph, index) => (
      <p
        key={`${index}-${paragraph}`}
        className="max-w-[68ch] text-[12.5px] leading-relaxed text-composer-text-secondary select-text"
      >
        {paragraph}
      </p>
    ))}
    {rule.aside ? (
      <p className="max-w-[68ch] border-l-2 border-composer-border-hover pl-2.5 text-xs text-composer-text-muted select-text">
        {rule.aside}
      </p>
    ) : null}
    {rule.example ? (
      <div
        data-rule-example=""
        className="mt-1.5 divide-y divide-composer-border overflow-hidden rounded-lg border border-composer-border"
      >
        <ExampleRow kind="wrong">{rule.example.wrong}</ExampleRow>
        <ExampleRow kind="right">{rule.example.right}</ExampleRow>
      </div>
    ) : null}
  </article>
);

// -- Exports -------------------------------------------------------------------

export { RuleCard };
