import { useFieldError } from "@/hooks/useFieldError";
import { useThemeStore } from "@/stores/theme";
import { Button } from "@/ui/button";
import { FieldError } from "@/ui/field-error";
import { INPUT_STYLES } from "@/ui/input-styles";
import { type EditorTarget, ThemeEditor } from "@/ui/settings/theme/theme-editor";
import { ThemePresetGallery } from "@/ui/settings/theme/theme-preset-gallery";
import { cn } from "@/utils/cn";
import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";

// -- Components ----------------------------------------------------------------

const ThemeSettings: React.FC = () => {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [importValue, setImportValue] = useState("");
  const codeField = useFieldError();

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
    if (importValue.trim() === "") {
      codeField.showError("Paste a theme code first");
      return;
    }
    try {
      useThemeStore.getState().importThemeCode(importValue.trim());
      setImportValue("");
      codeField.clearError();
    } catch (error) {
      codeField.showError(error instanceof Error ? error.message : "Invalid theme code");
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
            {...codeField.fieldProps}
            value={importValue}
            onChange={(event) => {
              setImportValue(event.target.value);
              codeField.clearError();
            }}
            placeholder="ctm1:dark:..."
            aria-label="Theme code"
            spellCheck={false}
            className={cn(INPUT_STYLES, "min-w-0 flex-1 h-9 py-0 rounded-[10px] font-mono text-xs select-text")}
          />
          <Button size="lg" variant="secondary" hasIcon onClick={handleImport}>
            <IconDownload className="size-4" />
            Import
          </Button>
        </div>
        <FieldError {...codeField.errorProps} />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeSettings };
