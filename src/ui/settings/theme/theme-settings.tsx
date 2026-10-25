import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { type EditorTarget, ThemeEditor } from "@/ui/settings/theme/theme-editor";
import { ThemePresetGallery } from "@/ui/settings/theme/theme-preset-gallery";
import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";

// -- Components ----------------------------------------------------------------

const ThemeSettings: React.FC = () => {
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
    return <ThemeEditor target={editor} onClose={handleEditorClose} />;
  }

  return (
    <div>
      <ThemePresetGallery onCustomize={handleCustomize} onEditCustom={handleEditCustom} />
      <div className="flex flex-col gap-3 py-3.5">
        <div className="flex flex-col gap-[3px] select-none">
          <span className="text-sm font-medium text-composer-text">Import a theme code</span>
          <span className="max-w-[52ch] text-[12.5px] leading-[1.45] text-(--muted) text-pretty">
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
            className="min-w-0 flex-1 h-9 rounded-[10px] border border-(--edge) bg-(--well) px-2.5 font-mono text-xs text-composer-text placeholder:text-(--muted) outline-none cursor-text select-text focus:border-(--lit-ring)"
          />
          <Button size="lg" variant="secondary" hasIcon onClick={handleImport} disabled={importValue.trim() === ""}>
            <IconDownload className="size-4" />
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

export { ThemeSettings };
