import { askChoiceWithCheckbox } from "@/stores/choice-store";
import { useSettingsStore } from "@/stores/settings";
import { UndoHint } from "@/ui/undo-hint";
import { pluralWord } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

type DivergenceResolution = "apply" | "detach" | "cancel";

interface DivergenceOptions {
  affectedSiblingCount: number;
  groupLabel?: string;
  widensCopies?: boolean;
}

// -- Constants ----------------------------------------------------------------

const FINISH_CHOOSING_FIRST = "Finish the open prompt first";

// -- Components ---------------------------------------------------------------

const DivergenceBody: React.FC<DivergenceOptions> = ({ affectedSiblingCount, groupLabel, widensCopies }) => (
  <>
    <div className="text-sm text-composer-text-secondary leading-relaxed select-text">
      You changed the word count on a line in <strong>{groupLabel ?? "this group"}</strong>. {affectedSiblingCount}{" "}
      other {pluralWord(affectedSiblingCount, "instance")} will be affected.
      <br />
      <br />
      <strong>Apply to all</strong> (recommended)
      <br />
      {widensCopies
        ? "Merges the same text in every instance. Where an instance splits it at different points, the merge grows to cover whole syllables, so that instance also loses syllable breaks you didn't select."
        : "Mirrors the new word structure across every instance. Words that didn't actually change keep their existing timing, so per-instance rhythms you've already tuned stay intact. Only the split or merged word's slot gets re-divided."}
      <br />
      <br />
      <strong>Detach</strong>
      <br />
      Keeps the change on this line only and unlinks it from the group. Other instances stay exactly as they were.
    </div>
    <UndoHint />
  </>
);

// -- Prompt -------------------------------------------------------------------

async function askWordDivergence(options: DivergenceOptions): Promise<DivergenceResolution> {
  const saved = useSettingsStore.getState().linkedDivergenceAction;
  if (saved !== "ask") return saved;
  const { answer, checked } = await askChoiceWithCheckbox({
    title: "Word structure changed",
    body: <DivergenceBody {...options} />,
    busyMessage: FINISH_CHOOSING_FIRST,
    checkbox: { label: "Don't ask again" },
    options: [
      { value: "detach", label: "Detach", variant: "secondary" },
      { value: "apply", label: "Apply to all", variant: "primary" },
    ],
  });
  if (checked && answer !== "cancel") useSettingsStore.getState().set("linkedDivergenceAction", answer);
  return answer;
}

// -- Exports ------------------------------------------------------------------

export { askWordDivergence };
