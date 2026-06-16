import { useState } from "react";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { ThemeEditor } from "@/ui/settings/theme/theme-editor";
import { ThemePresetGallery } from "@/ui/settings/theme/theme-preset-gallery";
import { IconDownload } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ThemeSectionProps {
  onResetTour: () => void;
  onClose: () => void;
}

// -- Components ----------------------------------------------------------------

const ThemeSection: React.FC<ThemeSectionProps> = () => {
  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const handleCustomize = () => {
    setEditingBaseId(useThemeStore.getState().activeThemeId);
  };

  const handleEditorClose = () => {
    setEditingBaseId(null);
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

  if (editingBaseId) {
    return (
      <div className="py-3">
        <ThemeEditor baseThemeId={editingBaseId} onClose={handleEditorClose} />
      </div>
    );
  }

  return (
    <div className="divide-y divide-composer-border">
      <div className="py-3">
        <ThemePresetGallery onCustomize={handleCustomize} />
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
