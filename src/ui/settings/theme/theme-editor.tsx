import { Activity, useEffect, useState } from "react";
import { contrastRatio } from "@/domain/theme/color";
import { deriveTheme } from "@/domain/theme/derive";
import type { Scheme, Theme, TokenKey } from "@/domain/theme/model";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { ThemeEditorAdvanced } from "@/ui/settings/theme/theme-editor-advanced";
import { ThemeEditorQuick } from "@/ui/settings/theme/theme-editor-quick";
import { ThemeShareBox } from "@/ui/settings/theme/theme-share-box";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { cn } from "@/utils/cn";
import { IconAlertTriangle } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

type EditorTarget = { mode: "create"; baseId: string } | { mode: "edit"; themeId: string };

interface ThemeEditorProps {
  target: EditorTarget;
  onClose: () => void;
}

type EditorTab = "quick" | "advanced";

// -- Helpers -------------------------------------------------------------------

function forkTheme(baseThemeId: string): Theme {
  const base = useThemeStore.getState().getThemeById(baseThemeId) ?? PRESET_BY_ID.get(DEFAULT_PRESET_ID);
  if (!base) {
    throw new Error("No base theme available to fork.");
  }
  return {
    id: crypto.randomUUID(),
    name: `${base.name} (copy)`,
    kind: "custom",
    base: baseThemeId,
    scheme: base.scheme,
    tokens: { ...base.tokens },
  };
}

function initialDraft(target: EditorTarget): Theme {
  if (target.mode === "edit") {
    const existing = useThemeStore.getState().getThemeById(target.themeId);
    if (existing) {
      return { ...existing, tokens: { ...existing.tokens } };
    }
  }
  return forkTheme(target.mode === "create" ? target.baseId : DEFAULT_PRESET_ID);
}

// -- Constants -----------------------------------------------------------------

const SCHEMES: { value: Scheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const TABS: { value: EditorTab; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "advanced", label: "Advanced" },
];

const MIN_AA_CONTRAST = 4.5;

const SEGMENT = "inline-flex gap-0.5 rounded-lg bg-composer-bg-dark p-0.5 select-none";

const SEGMENT_BUTTON =
  "rounded-md px-3 py-1 text-xs font-semibold cursor-pointer transition-colors text-composer-text-muted hover:text-composer-text";

const SEGMENT_BUTTON_ACTIVE = "bg-composer-bg-elevated text-composer-text hover:text-composer-text";

// -- Components ----------------------------------------------------------------

const ThemeEditor: React.FC<ThemeEditorProps> = ({ target, onClose }) => {
  const [draft, setDraft] = useState<Theme>(() => initialDraft(target));
  const [tab, setTab] = useState<EditorTab>("quick");
  const isEdit = target.mode === "edit";

  useEffect(() => {
    applyResolvedTheme(deriveTheme(draft), draft.scheme);
  }, [draft]);

  const resolved = deriveTheme(draft);
  const ratio = contrastRatio(resolved.text, resolved.bg);
  const lowContrast = ratio < MIN_AA_CONTRAST;

  const handleTokenChange = (key: TokenKey, value: string) => {
    setDraft((current) => ({ ...current, tokens: { ...current.tokens, [key]: value } }));
  };

  const handleSave = () => {
    if (isEdit) {
      useThemeStore.getState().updateCustomTheme(draft.id, draft);
    } else {
      useThemeStore.getState().addCustomTheme(draft);
    }
    useThemeStore.getState().setActiveTheme(draft.id);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-mono tracking-wider text-composer-text-faint select-none">Theme name</span>
        <div className="flex items-stretch gap-3">
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            aria-label="Theme name"
            spellCheck={false}
            className="flex-1 min-w-0 rounded-lg border border-composer-border bg-composer-input px-3 py-1.5 text-sm text-composer-text outline-none cursor-text select-text focus:border-composer-border-hover"
          />
          <Button size="sm" variant="ghost" className="h-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-composer-text select-none">Base</span>
        {/* react-doctor-disable-next-line react-doctor/prefer-tag-over-role -- no native element for a segmented control; role=group + aria-label is the standard pattern */}
        <div className={SEGMENT} role="group" aria-label="Color scheme">
          {SCHEMES.map((scheme) => (
            <button
              key={scheme.value}
              type="button"
              aria-pressed={draft.scheme === scheme.value}
              onClick={() => setDraft((current) => ({ ...current, scheme: scheme.value }))}
              className={cn(SEGMENT_BUTTON, draft.scheme === scheme.value && SEGMENT_BUTTON_ACTIVE)}
            >
              {scheme.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-composer-text-faint select-none">flips contrast and color-scheme</span>
      </div>

      <div className={SEGMENT}>
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={cn(SEGMENT_BUTTON, tab === entry.value && SEGMENT_BUTTON_ACTIVE)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {lowContrast && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-composer-warning/20 bg-composer-warning/10 px-2.5 py-2 text-xs text-composer-warning select-text cursor-text"
        >
          <IconAlertTriangle size={14} className="shrink-0" />
          <span>{`Text on background is ${ratio.toFixed(1)}:1, below WCAG AA (4.5:1)`}</span>
        </div>
      )}

      <Activity mode={tab === "quick" ? "visible" : "hidden"}>
        <ThemeEditorQuick draft={draft} onTokenChange={handleTokenChange} />
      </Activity>
      <Activity mode={tab === "advanced" ? "visible" : "hidden"}>
        <ThemeEditorAdvanced draft={draft} onTokenChange={handleTokenChange} />
      </Activity>

      <div className="border-t border-composer-border pt-4">
        <ThemeShareBox draft={draft} />
      </div>

      <div className="flex items-center gap-2 border-t border-composer-border pt-4">
        <Button size="sm" variant="primary" onClick={handleSave}>
          {isEdit ? "Save changes" : "Save theme"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Discard
        </Button>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeEditor };
export type { EditorTarget };
