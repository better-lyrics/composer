import { useChoiceStore } from "@/stores/choice-store";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { useRef } from "react";

// -- Constants ----------------------------------------------------------------

const DESCRIBED_BY_ID = "choice-modal-body";

// -- Component ----------------------------------------------------------------

const ChoiceModalHost: React.FC = () => {
  const request = useChoiceStore((state) => state.request);
  const answer = useChoiceStore((state) => state.answer);
  const checked = useChoiceStore((state) => state.checked);
  const setChecked = useChoiceStore((state) => state.setChecked);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  if (!request) return null;

  const primaryIndex = request.options.findIndex((option) => option.variant === "primary");

  return (
    <Modal
      isOpen
      onClose={() => answer("cancel")}
      title={request.title}
      className="max-w-md"
      role="alertdialog"
      describedById={DESCRIBED_BY_ID}
      initialFocusRef={primaryIndex === -1 ? cancelRef : primaryRef}
    >
      <div className="flex flex-col gap-4">
        {typeof request.body === "string" ? (
          <p className="m-0 text-sm leading-relaxed text-composer-text-secondary select-text">{request.body}</p>
        ) : (
          request.body
        )}
        <div className="flex items-center justify-end gap-2 pt-1 select-none">
          {request.checkbox && (
            <label className="flex items-center gap-2 mr-auto text-xs text-composer-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
                className="size-3.5 rounded accent-composer-accent cursor-pointer"
              />
              {request.checkbox.label}
            </label>
          )}
          <Button ref={cancelRef} variant="ghost" onClick={() => answer("cancel")}>
            Cancel
          </Button>
          {request.options.map((option, index) => (
            <Button
              key={option.value}
              ref={index === primaryIndex ? primaryRef : undefined}
              variant={option.variant}
              onClick={() => answer(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { ChoiceModalHost };
