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
import { useState } from "react";
import type { LyricLine, RomanizationData } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";

// -- Types --------------------------------------------------------------------

interface RomanizationEditPopoverProps {
  line: LyricLine;
  isOpen: boolean;
  onClose: () => void;
  anchor?: HTMLElement | null;
}

// -- Helpers ------------------------------------------------------------------

const focusAndSelectOnMount = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.focus();
  el.select();
};

function buildRomanizationData(input: string): RomanizationData {
  return { text: input, source: "manual" };
}

// -- Component ----------------------------------------------------------------

const RomanizationEditPopover: React.FC<RomanizationEditPopoverProps> = ({ line, isOpen, onClose, anchor }) => {
  const [input, setInput] = useState(line.romanization?.text ?? "");

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

  const handleSave = () => {
    useProjectStore.getState().setLineRomanizationWithHistory(line.id, buildRomanizationData(input));
    onClose();
  };

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-100 p-3 w-72 border select-none shadow-2xl rounded-xl bg-composer-bg border-composer-border"
        >
          <p className="mb-1.5 text-xs text-composer-text-secondary">Romanization</p>
          <textarea
            ref={focusAndSelectOnMount}
            aria-label="Romanization text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            rows={3}
            className="w-full px-2 py-1.5 text-sm border rounded resize-none cursor-text bg-composer-input border-composer-border focus:outline-none focus:border-composer-accent"
          />
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationEditPopover };
export type { RomanizationEditPopoverProps };
