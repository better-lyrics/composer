// -- Interfaces ----------------------------------------------------------------

interface NoMatchMessageProps {
  noun: string;
  query: string;
}

// -- Constants -----------------------------------------------------------------

const MAX_QUERY_CHARS = 24;

// -- Components ----------------------------------------------------------------

const NoMatchMessage: React.FC<NoMatchMessageProps> = ({ noun, query }) => {
  const trimmed = query.trim();
  const chars = Array.from(trimmed);
  const shown = chars.length > MAX_QUERY_CHARS ? `${chars.slice(0, MAX_QUERY_CHARS).join("").trimEnd()}…` : trimmed;
  return (
    <span title={shown === trimmed ? undefined : trimmed}>
      No {noun} match “{shown}”
    </span>
  );
};

// -- Exports -------------------------------------------------------------------

export { NoMatchMessage };
