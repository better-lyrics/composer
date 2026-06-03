import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import type { LyricLine, RomanizationData } from "@/domain/line/model";
import { generateForWord } from "@/domain/romanization/generate";
import { defaultSchemeForLang } from "@/domain/romanization/schemes";
import { detectNonLatinLanguage } from "@/domain/romanization/detect";
import { useProjectStore } from "@/stores/project";
import { getRomanizationTurnstileSiteKey, useSettingsStore } from "@/stores/settings";
import { Button } from "@/ui/button";
import { toastBulkResult, toastError } from "@/utils/romanization/toast";

// -- Constants ----------------------------------------------------------------

const NO_SITE_KEY_TOOLTIP = "Set a Turnstile site key in Settings > Romanization";

// -- Types --------------------------------------------------------------------

interface RomanizationWordEditPopoverProps {
  line: LyricLine;
  wordIndex: number;
  isOpen: boolean;
  onClose: () => void;
  anchor?: HTMLElement | null;
}

// -- Helpers ------------------------------------------------------------------

const focusAndSelectOnMount = (el: HTMLInputElement | null) => {
  if (!el) return;
  el.focus();
  el.select();
};

function buildWordTexts(line: LyricLine, wordIndex: number, value: string): string[] {
  const wordCount = line.words?.length ?? 0;
  const existing = line.romanization?.wordTexts;
  const base = existing?.length === wordCount ? [...existing] : new Array<string>(wordCount).fill("");
  base[wordIndex] = value;
  return base;
}

function resolveSchemeForLine(line: LyricLine): string {
  const stored = useProjectStore.getState().metadata.romanizationScheme;
  if (stored) return stored;
  const detected = detectNonLatinLanguage(line.text);
  return detected ? defaultSchemeForLang(detected) : "und-Latn";
}

// -- Component ----------------------------------------------------------------

const RomanizationWordEditPopover: React.FC<RomanizationWordEditPopoverProps> = ({
  line,
  wordIndex,
  isOpen,
  onClose,
  anchor,
}) => {
  const initialValue = line.romanization?.wordTexts?.[wordIndex] ?? "";
  const [input, setInput] = useState(initialValue);
  const [isRegenerating, setIsRegenerating] = useState(false);
  useSettingsStore((s) => s.romanizationTurnstileSiteKey);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    placement: "bottom-start",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    elements: { reference: anchor ?? undefined },
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen) return null;

  const siteKey = getRomanizationTurnstileSiteKey();
  const siteKeyMissing = siteKey.length === 0;

  const handleSave = () => {
    const wordTexts = buildWordTexts(line, wordIndex, input);
    const data: RomanizationData = {
      text: wordTexts.join(" "),
      wordTexts,
      source: "manual",
    };
    useProjectStore.getState().setLineRomanizationWithHistory(line.id, data);
    onClose();
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const summary = await generateForWord(resolveSchemeForLine(line), line, wordIndex);
      toastBulkResult(summary);
      if (summary.successCount > 0) onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-100 p-3 w-60 border select-none shadow-2xl rounded-xl bg-composer-bg border-composer-border"
        >
          <p className="mb-1.5 text-xs text-composer-text-secondary">Syllable romanization</p>
          <input
            ref={focusAndSelectOnMount}
            type="text"
            aria-label="Romanization word"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            className="w-full px-2 py-1.5 text-sm border rounded cursor-text bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
          />
          <div className="flex items-center justify-between gap-1.5 mt-2">
            <Button
              hasIcon
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating || siteKeyMissing}
              title={siteKeyMissing ? NO_SITE_KEY_TOOLTIP : undefined}
            >
              <IconRefresh className="size-3.5" />
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </Button>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationWordEditPopover };
export type { RomanizationWordEditPopoverProps };
