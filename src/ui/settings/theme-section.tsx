import { useState } from "react";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { type EditorTarget, ThemeEditor } from "@/ui/settings/theme/theme-editor";
import { ThemePresetGallery } from "@/ui/settings/theme/theme-preset-gallery";
import { IconDownload } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeSectionProps {
  onResetTour: () => void;
  onClose: () => void;
}

// -- Components ----------------------------------------------------------------

const ThemeSection: React.FC<ThemeSectionProps> = () => {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const handleCustomize = () => {
    setEditor({ mode: "create", baseId: useThemeStore.getState().activeThemeId });
  };

  const handleEditCustom = (themeId: string) => {
    setEditor({ mode: "edit", themeId });
  };

  const handleEditorClose = () => {
    setEditor(null);
    const id = useThemeStore.getState().activeThemeId;
    useThemeStore.getState().setActiveTheme(id);
  };

  const handleImport = () => {
    try {
      useThemeStore.getState().importThemeCode(importValue.trim());
      setImportValue("");
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Invalid theme code");
    }
  };

  if (editor) {
    return (
      <div className="py-3">
        <ThemeEditor target={editor} onClose={handleEditorClose} />
      </div>
    );
  }

  return (
    <div className="divide-y divide-composer-border">
      <div className="pt-3 pb-4">
        <ThemePresetGallery onCustomize={handleCustomize} onEditCustom={handleEditCustom} />
      </div>
      <div className="flex flex-col gap-2 py-3">
        <div className="flex flex-col gap-0.5 select-none">
          <span className="text-sm font-medium text-composer-text">Import a theme code</span>
          <span className="text-xs text-composer-text-muted">
            Paste a code shared by someone else to add it to your themes.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={importValue}
            onChange={(event) => setImportValue(event.target.value)}
            placeholder="ctm1:dark:..."
            aria-label="Theme code"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-composer-border bg-composer-input px-3 py-1.5 font-mono text-xs text-composer-text outline-none cursor-text select-text focus:border-composer-border-hover"
          />
          <Button size="sm" variant="secondary" hasIcon onClick={handleImport} disabled={importValue.trim() === ""}>
            <IconDownload size={14} />
            Import
          </Button>
        </div>
        {importError && (
          <span role="alert" className="text-xs text-composer-error select-text cursor-text">
            {importError}
          </span>
        )}
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeSection };
