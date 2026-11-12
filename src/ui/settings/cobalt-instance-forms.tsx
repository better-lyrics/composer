import { useFieldError } from "@/hooks/useFieldError";
import { Button } from "@/ui/button";
import { FieldError } from "@/ui/field-error";
import { cn } from "@/utils/cn";
import { focusOnMount } from "@/utils/focus-on-mount";
import { displayHostFromUrl, ensureHttpScheme, isValidHttpUrl } from "@/utils/url";
import { useState } from "react";

// -- Constants ----------------------------------------------------------------

const EMPTY_NAME_MESSAGE = "Type a name first";
const INVALID_URL_MESSAGE = "Enter a valid http(s) URL.";
const LABEL_STYLES = "text-xs text-composer-text-muted select-none";
const INPUT_BASE_STYLES =
  "w-full px-2 text-xs rounded-md bg-(--well) border focus:outline-none text-composer-text placeholder:text-composer-text-muted";

// -- Hooks --------------------------------------------------------------------

function useInstanceDraft(initialLabel: string, initialUrl: string, onSubmit: (label: string, url: string) => void) {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState(initialUrl);
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const nameField = useFieldError();
  const urlField = useFieldError(trimmedUrl !== "" && !isValidHttpUrl(trimmedUrl) ? INVALID_URL_MESSAGE : null);

  const submit = () => {
    if (trimmedLabel === "") {
      nameField.showError(EMPTY_NAME_MESSAGE);
    } else if (trimmedUrl === "") {
      urlField.showError(INVALID_URL_MESSAGE);
    } else if (!isValidHttpUrl(trimmedUrl)) {
      urlField.showFormatError();
    } else {
      onSubmit(trimmedLabel, ensureHttpScheme(url));
    }
  };

  const changeLabel = (next: string) => {
    setLabel(next);
    nameField.clearError();
  };
  const changeUrl = (next: string) => {
    setUrl(next.replace(/\s+/g, ""));
    urlField.clearError();
  };

  return { label, url, nameField, urlField, submit, changeLabel, changeUrl };
}

type InstanceDraft = ReturnType<typeof useInstanceDraft>;

// -- Components ---------------------------------------------------------------

const InstanceFields: React.FC<{
  draft: InstanceDraft;
  inputHeight: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  focusName?: boolean;
  children: React.ReactNode;
}> = ({ draft, inputHeight, onKeyDown, focusName = false, children }) => {
  const borderFor = (error: string | null) =>
    error === null ? "border-(--edge) focus:border-composer-accent" : "border-composer-error";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 w-32">
          <span className={LABEL_STYLES}>Name</span>
          <input
            ref={focusName ? focusOnMount : undefined}
            type="text"
            {...draft.nameField.fieldProps}
            value={draft.label}
            onChange={(e) => draft.changeLabel(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn(INPUT_BASE_STYLES, inputHeight, borderFor(draft.nameField.error))}
          />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-0">
          <span className={LABEL_STYLES}>URL</span>
          <input
            type="url"
            inputMode="url"
            {...draft.urlField.fieldProps}
            placeholder="https://your-cobalt-instance"
            value={draft.url}
            onChange={(e) => draft.changeUrl(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn(INPUT_BASE_STYLES, "font-mono", inputHeight, borderFor(draft.urlField.error))}
          />
        </label>
        {children}
      </div>
      <FieldError {...draft.nameField.errorProps} className="text-[11px]" />
      <FieldError {...draft.urlField.errorProps} className="text-[11px]" />
    </div>
  );
};

const CobaltInstanceEditRow: React.FC<{
  initialLabel: string;
  initialUrl: string;
  onSave: (label: string, url: string) => void;
  onCancel: () => void;
}> = ({ initialLabel, initialUrl, onSave, onCancel }) => {
  const draft = useInstanceDraft(initialLabel, displayHostFromUrl(initialUrl), onSave);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      draft.submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="p-2 rounded-lg border border-composer-accent/50 bg-composer-accent/10">
      <InstanceFields draft={draft} inputHeight="h-6" onKeyDown={handleKeyDown} focusName>
        <Button size="sm" variant="primary" onClick={draft.submit} className="h-6 px-2.5">
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} className="h-6 px-2.5">
          Cancel
        </Button>
      </InstanceFields>
    </div>
  );
};

const CobaltInstanceAddForm: React.FC<{
  onAdd: (label: string, url: string) => void;
}> = ({ onAdd }) => {
  const draft = useInstanceDraft("", "", (label, url) => {
    onAdd(label, url);
    draft.changeLabel("");
    draft.changeUrl("");
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      draft.submit();
    }
  };

  return (
    <div className="mt-4">
      <InstanceFields draft={draft} inputHeight="h-7" onKeyDown={handleKeyDown}>
        <Button size="sm" variant="primary" onClick={draft.submit}>
          Add
        </Button>
      </InstanceFields>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { CobaltInstanceEditRow, CobaltInstanceAddForm };
