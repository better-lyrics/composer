import { useId } from "react";

const LanguageField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  stale?: boolean;
  error?: string | null;
  pasteKind?: "transliteration" | "translation";
  pasteLanguage?: string;
  action?: React.ReactNode;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, stale, error, pasteKind, pasteLanguage, action, onChange }) => {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs text-composer-text-muted">
        <span className="flex items-center gap-2">
          <label htmlFor={inputId}>{label}</label>
          {stale && <span className="text-amber-400">Needs review</span>}
        </span>
        {action}
      </div>
      <input
        id={inputId}
        value={value}
        data-language-import-kind={pasteKind}
        data-language-import-language={pasteLanguage}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 px-3 font-mono text-sm border rounded-md bg-composer-input focus:outline-none ${error ? "border-red-500 focus:border-red-400" : "border-composer-border focus:border-composer-accent"}`}
      />
      {error && <span className="text-xs leading-4 text-red-400">{error}</span>}
    </div>
  );
};

export { LanguageField };
