import { decodeShortcutCode } from "@/stores/shortcut-code";
import { shortcutPreset } from "@/stores/shortcut-presets";
import { INPUT_STYLES } from "@/ui/input-styles";
import { PopActions, PopBody, PopButton, PopHead, PopText } from "@/ui/pop-layout";
import { Popover } from "@/ui/popover";
import { CARD_BASE, CARD_INACTIVE } from "@/ui/settings/preset-card-styles";
import { applyShortcutsWithUndo } from "@/ui/settings/shortcuts/switch-shortcut-preset";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { IconDownload } from "@tabler/icons-react";
import { useState } from "react";

// -- Helpers -------------------------------------------------------------------

function importedDescription(presetName: string, changedCount: number): string {
  if (changedCount === 0) return `${presetName}, with no keys changed.`;
  return `${presetName}, with ${pluralize(changedCount, "key")} changed.`;
}

// -- Components ----------------------------------------------------------------

const ImportCodeForm: React.FC<{ onImported: () => void }> = ({ onImported }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    try {
      const { preset, overrides } = decodeShortcutCode(code);
      const description = importedDescription(shortcutPreset(preset).name, Object.keys(overrides).length);
      applyShortcutsWithUndo(preset, overrides, "Imported shortcuts", description);
      onImported();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleImport();
      }}
    >
      <div className="px-2.5 mt-2.5 flex flex-col gap-1.5">
        <input
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          placeholder="csk1:editor:..."
          aria-label="Shortcuts code"
          spellCheck={false}
          className={cn(INPUT_STYLES, "w-full h-8 font-mono text-xs select-text")}
        />
        {error && (
          <span role="alert" className="text-xs text-composer-error select-text cursor-text">
            {error}
          </span>
        )}
      </div>
      <PopActions className="mt-3">
        <PopButton type="submit" variant="primary" disabled={code.trim() === ""}>
          Import
        </PopButton>
      </PopActions>
    </form>
  );
};

const ShortcutImportCard: React.FC = () => (
  <Popover
    placement="bottom-end"
    aria-label="Import shortcuts"
    trigger={
      <button type="button" className={cn(CARD_BASE, CARD_INACTIVE, "flex-1 px-3 pb-3 justify-between")}>
        <IconDownload aria-hidden="true" className="size-4 text-(--muted)" />
        <span className="mt-auto">
          <span className="block text-[13px] font-bold text-composer-text">Import a code</span>
          <span className="block mt-0.5 text-[11.5px] leading-[1.4] text-(--muted)">Use keys someone shared.</span>
        </span>
      </button>
    }
  >
    {(close) => (
      <PopBody>
        <PopHead title="Import shortcuts" />
        <PopText>Paste a code to use someone's keys. You can undo it.</PopText>
        <ImportCodeForm onImported={close} />
      </PopBody>
    )}
  </Popover>
);

// -- Exports -------------------------------------------------------------------

export { ShortcutImportCard };
