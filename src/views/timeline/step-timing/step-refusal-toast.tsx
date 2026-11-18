import type { StepRefusal } from "insync/step-timing-step-write";
import { SettingLink } from "@/ui/setting-link";

// -- Functions ----------------------------------------------------------------

function stepRefusalContent(refusal: StepRefusal): React.ReactNode {
  if (refusal.reason === "beforePrevious") {
    const word = refusal.previousWord.trim();
    return `This time is before “${word}” ends. Click “${word}” to retime it.`;
  }
  if (refusal.reason === "minDuration") {
    const previous = refusal.previousWord.trim();
    const problem =
      refusal.short === "previous"
        ? `“${previous}” would be shorter than ${refusal.minMs} ms.`
        : `“${refusal.word.trim()}” needs at least ${refusal.minMs} ms, and “${previous}” is in the way.`;
    return (
      <>
        {problem} Retime “{previous}”, or lower <SettingLink setting="minWordDuration" />.
      </>
    );
  }
  if (refusal.reason === "songStart") return "This word can't start before the song does.";
  return "There is no room for the words after this one before the song ends.";
}

// -- Exports ------------------------------------------------------------------

export { stepRefusalContent };
