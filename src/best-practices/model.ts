// -- Interfaces ----------------------------------------------------------------

interface RuleExample {
  wrong: React.ReactNode;
  right: React.ReactNode;
}

interface Rule {
  id: string;
  title: string;
  body: string[];
  aside?: string;
  example?: RuleExample;
}

interface RuleGroup {
  id: string;
  label: string;
  rules: Rule[];
}

// -- Exports -------------------------------------------------------------------

export type { Rule, RuleExample, RuleGroup };
