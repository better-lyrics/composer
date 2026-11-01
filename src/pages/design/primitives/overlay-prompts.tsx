import { ResultLine } from "@/pages/design/primitives/interaction-cells";
import { PrimitiveBlock, StateCell, StateGrid } from "@/pages/design/state-cell";
import { askChoice } from "@/stores/choice-store";
import { useConfirm } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { PROSE } from "@/ui/typography";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

type OpenSongChoice = "open" | "new";

// -- Constants -----------------------------------------------------------------

const OPEN_SONG_LABELS: Record<OpenSongChoice | "cancel", string> = {
  open: "Chose Open it",
  new: "Chose Start a new project",
  cancel: "Cancelled",
};

// -- Components ----------------------------------------------------------------

const ModalBlock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  return (
    <PrimitiveBlock name="Modal" note="Use it for a focused task that must finish or be dismissed before you go on.">
      <StateGrid>
        <StateCell label="Press to open">
          <Button onClick={() => setIsOpen(true)}>Open modal</Button>
        </StateCell>
      </StateGrid>
      <Modal isOpen={isOpen} onClose={close} title="About this modal">
        <p className={PROSE}>Focus stays inside until you close it, and returns to the button that opened it.</p>
        <div className="flex justify-end mt-5">
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </div>
      </Modal>
    </PrimitiveBlock>
  );
};

const ConfirmBlock: React.FC = () => {
  const confirm = useConfirm();
  const [result, setResult] = useState<string | null>(null);

  const askPrimary = async () => {
    const confirmed = await confirm({
      title: "Apply your TTML edits?",
      description: "Your edits replace the lyrics in this project.",
      confirmLabel: "Apply",
      variant: "primary",
    });
    setResult(confirmed ? "Applied" : "Cancelled");
  };

  const askDestructive = async () => {
    const confirmed = await confirm({
      title: "Delete this project?",
      description: "The lyrics, timing and stored audio go with it.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    setResult(confirmed ? "Deleted" : "Cancelled");
  };

  return (
    <PrimitiveBlock
      name="Confirm"
      note="Use it for a yes or no before an action. A destructive one focuses Cancel, so Enter never deletes."
    >
      <StateGrid>
        <StateCell label="Primary">
          <Button onClick={askPrimary}>Apply edits</Button>
        </StateCell>
        <StateCell label="Destructive">
          <Button variant="danger" onClick={askDestructive}>
            Delete project
          </Button>
        </StateCell>
      </StateGrid>
      <ResultLine result={result} />
    </PrimitiveBlock>
  );
};

const ChoiceBlock: React.FC = () => {
  const [result, setResult] = useState<string | null>(null);

  const ask = async () => {
    const answer = await askChoice<OpenSongChoice>({
      title: "This song is already open",
      body: "Open the project you have, or start a new one for the same song.",
      busyMessage: "Finish the open prompt first.",
      options: [
        { value: "open", label: "Open it", variant: "primary" },
        { value: "new", label: "Start a new project", variant: "secondary" },
      ],
    });
    setResult(OPEN_SONG_LABELS[answer]);
  };

  return (
    <PrimitiveBlock name="Choice" note="Use it when a prompt needs more than yes or no, with every option named.">
      <StateGrid>
        <StateCell label="Press to ask">
          <Button onClick={ask}>Open song</Button>
        </StateCell>
      </StateGrid>
      <ResultLine result={result} />
    </PrimitiveBlock>
  );
};

// -- Exports -------------------------------------------------------------------

export { ChoiceBlock, ConfirmBlock, ModalBlock };
