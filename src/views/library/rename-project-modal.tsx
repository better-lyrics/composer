import { Button } from "@/ui/button";
import { INPUT_STYLES } from "@/ui/input-styles";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import { useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface RenameProjectModalProps {
  title: string;
  onRename: (title: string) => void;
  onClose: () => void;
}

// -- Component ----------------------------------------------------------------

const RenameProjectModal: React.FC<RenameProjectModalProps> = ({ title, onRename, onClose }) => {
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Modal isOpen onClose={onClose} title="Rename project" className="max-w-md" initialFocusRef={inputRef}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onRename(value);
        }}
        className="flex flex-col gap-4"
      >
        <input
          ref={inputRef}
          aria-label="Project title"
          value={value}
          placeholder="Untitled"
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key !== "Escape") event.stopPropagation();
          }}
          className={cn(INPUT_STYLES, "w-full select-text")}
        />
        <div className="flex justify-end gap-2 select-none">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Rename
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { RenameProjectModal };
