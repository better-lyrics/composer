// -- Interfaces ----------------------------------------------------------------

interface TokenLabelProps {
  name: string;
  value?: string;
}

// -- Components ----------------------------------------------------------------

const TokenLabel: React.FC<TokenLabelProps> = ({ name, value }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-xs text-composer-text select-none break-all">{name}</span>
    {value !== undefined && (
      <span className="font-mono text-xs select-text cursor-text tabular-nums text-(--muted) break-all">
        {value || "Not set"}
      </span>
    )}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { TokenLabel };
