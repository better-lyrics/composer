import { contrastRatio } from "@/domain/theme/color";
import { deriveTheme } from "@/domain/theme/derive";
import type { Scheme, Theme, TokenKey } from "@/domain/theme/model";
import { DEFAULT_PRESET_ID, PRESET_BY_ID } from "@/domain/theme/presets";
import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { type SegmentedOption, SegmentedControl } from "@/ui/segmented-control";
import { ThemeEditorAdvanced } from "@/ui/settings/theme/theme-editor-advanced";
import { QuickModeNote, ThemeEditorQuick } from "@/ui/settings/theme/theme-editor-quick";
import { CopyThemeCodeButton, ThemeShareBox } from "@/ui/settings/theme/theme-share-box";
import { cn } from "@/utils/cn";
import { applyResolvedTheme } from "@/utils/theme/apply";
import { IconAlertTriangle, IconCheck, IconMoonStars, IconSun } from "@tabler/icons-react";
import { Activity, useEffect, useState } from "react";

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

const SCHEMES: readonly SegmentedOption<Scheme>[] = [
  { value: "dark", label: "Dark", icon: IconMoonStars },
  { value: "light", label: "Light", icon: IconSun },
];

const TABS: readonly SegmentedOption<EditorTab>[] = [
  { value: "quick", label: "Quick" },
  { value: "advanced", label: "Advanced" },
];

const MIN_AA_CONTRAST = 4.5;

// -- Components ----------------------------------------------------------------

const ThemeEditor: React.FC<ThemeEditorProps> = ({ target, onClose }) => {
  const [draft, setDraft] = useState<Theme>(() => initialDraft(target));
  const [tab, setTab] = useState<EditorTab>("quick");
  const isEdit = target.mode === "edit";
  useEscapeLayer("panel", true, onClose);

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
    <div className="flex flex-col">
      <div className="flex flex-col gap-3.5 pt-[18px] pb-4 border-b border-(--divider)">
        <span className="-mb-1.5 text-xs text-(--muted) select-none">Theme name</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            aria-label="Theme name"
            spellCheck={false}
            className={cn(INPUT_STYLES, "flex-1 min-w-0 h-9 px-2.5 text-sm rounded-[10px] select-text")}
          />
          <Button size="lg" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] text-(--label) select-none">Base</span>
          <SegmentedControl
            aria-label="Color scheme"
            value={draft.scheme}
            options={SCHEMES}
            onChange={(scheme) => setDraft((current) => ({ ...current, scheme }))}
            className="[&_svg]:size-[15px]"
          />
          <span className="text-xs text-composer-text-muted select-none">flips contrast and color-scheme</span>
        </div>

        <SegmentedControl
          aria-label="Editor mode"
          value={tab}
          options={TABS}
          onChange={setTab}
          className="self-start"
        />

        {tab === "quick" && <QuickModeNote />}

        {lowContrast && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-composer-warning/20 bg-composer-warning/10 px-2.5 py-2 text-xs text-composer-warning select-text cursor-text"
          >
            <IconAlertTriangle size={14} className="shrink-0" />
            <span>{`Text on background is ${ratio.toFixed(1)}:1, below WCAG AA (4.5:1)`}</span>
          </div>
        )}
      </div>

      <Activity mode={tab === "quick" ? "visible" : "hidden"}>
        <ThemeEditorQuick draft={draft} onTokenChange={handleTokenChange} />
      </Activity>
      <Activity mode={tab === "advanced" ? "visible" : "hidden"}>
        <ThemeEditorAdvanced draft={draft} onTokenChange={handleTokenChange} />
      </Activity>

      <div className="border-t border-(--divider) pt-4">
        <ThemeShareBox draft={draft} />
      </div>

      <div className="flex items-center gap-2 pt-4">
        <CopyThemeCodeButton draft={draft} />
        <span className="flex-1" />
        <Button size="lg" variant="ghost" onClick={onClose}>
          Discard
        </Button>
        <Button size="lg" variant="primary" hasIcon onClick={handleSave}>
          <IconCheck className="size-4" />
          {isEdit ? "Save changes" : "Save theme"}
        </Button>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeEditor };
export type { EditorTarget };
