import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TranslationTrack, TransliterationSegment } from "@/domain/language/model";
import { validateTransliterationAlignment } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";

function manualSegments(line: LyricLine, value: string): TransliterationSegment[] {
  return value.trim() ? [{ original: line.text, transliteration: value.trim() }] : [];
}

const Field: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  stale?: boolean;
  error?: string | null;
  pasteKind?: "transliteration" | "translation";
  pasteLanguage?: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, stale, error, pasteKind, pasteLanguage, onChange }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="flex items-center gap-2 text-xs text-composer-text-muted">
      {label}
      {stale && <span className="text-amber-400">Needs review</span>}
    </span>
    <input
      value={value}
      data-language-import-kind={pasteKind}
      data-language-import-language={pasteLanguage}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 px-3 text-sm border rounded-md bg-composer-input focus:outline-none ${error ? "border-red-500 focus:border-red-400" : "border-composer-border focus:border-composer-accent"}`}
    />
    {error && <span className="text-xs leading-4 text-red-400">{error}</span>}
  </label>
);

interface LanguageLineEditorProps {
  line: LyricLine;
  index: number;
  targets: string[];
  languageNames: ReadonlyMap<string, string>;
  sourceLanguage?: string;
}

const LanguageLineEditor: React.FC<LanguageLineEditorProps> = ({
  line,
  index,
  targets,
  languageNames,
  sourceLanguage,
}) => {
  const updateLine = useProjectStore((state) => state.updateLine);
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const update = (updates: Partial<LyricLine>) => updateLine(line.id, updates, { deriveText: false });

  return (
    <section className="p-4 border rounded-lg border-composer-border bg-composer-bg-elevated">
      <div className="mb-3 text-sm">
        <span className="mr-3 font-mono text-xs text-composer-text-muted">{index + 1}</span>
        {line.text}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field
          label="Transliteration"
          value={line.transliteration?.text ?? ""}
          placeholder="Generated automatically when available"
          stale={line.transliteration?.stale}
          error={validateTransliterationAlignment(line.text, line.transliteration?.text ?? "", line.words)}
          pasteKind="transliteration"
          onChange={(value) =>
            update({
              transliteration: value
                ? {
                    language: line.transliteration?.language ?? `${sourceLanguage || "und"}-Latn`,
                    text: value,
                    backgroundText: line.transliteration?.backgroundText,
                    segments: manualSegments(line, value),
                    backgroundSegments: line.transliteration?.backgroundSegments,
                    origin: "manual",
                    sourceFingerprint: fingerprint,
                  }
                : undefined,
            })
          }
        />
        {targets.map((language) => {
          const track = line.translations?.[language];
          return (
            <Field
              key={language}
              label={languageNames.get(language) ?? language}
              value={track?.text ?? ""}
              stale={track?.stale}
              pasteKind="translation"
              pasteLanguage={language}
              onChange={(value) => {
                const translations = { ...(line.translations ?? {}) };
                if (value)
                  translations[language] = {
                    language,
                    text: value,
                    backgroundText: track?.backgroundText,
                    origin: "manual",
                    sourceFingerprint: fingerprint,
                  } satisfies TranslationTrack;
                else delete translations[language];
                update({ translations });
              }}
            />
          );
        })}
      </div>
      {line.backgroundText && (
        <div className="mt-3 pl-4 border-l border-composer-border">
          <p className="mb-2 text-xs text-composer-text-muted">Background: {line.backgroundText}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field
              label="Background transliteration"
              value={line.transliteration?.backgroundText ?? ""}
              error={validateTransliterationAlignment(
                line.backgroundText,
                line.transliteration?.backgroundText ?? "",
                line.backgroundWords,
              )}
              pasteKind="transliteration"
              onChange={(value) => {
                const current = line.transliteration;
                if (!current) return;
                update({
                  transliteration: {
                    ...current,
                    backgroundText: value,
                    origin: "manual",
                    sourceFingerprint: fingerprint,
                  },
                });
              }}
            />
            {targets.map((language) => {
              const track = line.translations?.[language];
              return (
                <Field
                  key={language}
                  label={`Background ${languageNames.get(language) ?? language}`}
                  value={track?.backgroundText ?? ""}
                  pasteKind="translation"
                  pasteLanguage={language}
                  onChange={(value) => {
                    if (!track) return;
                    update({
                      translations: {
                        ...line.translations,
                        [language]: {
                          ...track,
                          backgroundText: value,
                          origin: "manual",
                          sourceFingerprint: fingerprint,
                        },
                      },
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export { LanguageLineEditor };
