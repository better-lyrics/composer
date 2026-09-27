import { escapeRegex } from "@/utils/escape-regex";
import { splitSearchTerms } from "@/utils/search-terms";

// -- Component -----------------------------------------------------------------

const HighlightMatches: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const terms = splitSearchTerms(query);
  if (terms.length === 0) return text;
  const parts = text.split(new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi"));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={`${index}-${part}`}
        className="bg-transparent text-composer-accent-text underline decoration-composer-accent/70 underline-offset-2"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};

// -- Exports -------------------------------------------------------------------

export { HighlightMatches };
