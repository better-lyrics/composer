import type { TtmlEditState } from "@/stores/project/types";
import { withoutAudioDuration } from "@/utils/ttml";

// -- Types --------------------------------------------------------------------

type TtmlEdit = NonNullable<TtmlEditState>;

// -- Rule ---------------------------------------------------------------------

function crossedProjectChange(edit: TtmlEdit, generated: string): boolean {
  return edit.lyricsChanged === true || withoutAudioDuration(edit.source) !== withoutAudioDuration(generated);
}

function marked(edit: TtmlEdit, crossed: boolean): TtmlEdit {
  return crossed ? { ...edit, lyricsChanged: true } : edit;
}

function typedTtmlEdit(prev: TtmlEditState, generated: string, content: string, hasConflict: boolean): TtmlEdit {
  if (prev !== null && hasConflict) return { ...prev, content };
  return marked({ source: generated, content }, prev !== null && crossedProjectChange(prev, generated));
}

function keptTtmlEdit(prev: TtmlEditState, generated: string): TtmlEditState {
  if (prev === null) return null;
  return marked({ source: generated, content: prev.content }, crossedProjectChange(prev, generated));
}

// -- Exports ------------------------------------------------------------------

export { crossedProjectChange, keptTtmlEdit, typedTtmlEdit };
