import { bindingsEqual } from "@/stores/shortcut-binding-compare";
import { type ShortcutPresetId, presetBinding } from "@/stores/shortcut-presets";
import { SHORTCUT_REGISTRY, type ShortcutBinding } from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface ShortcutChange {
  ids: string[];
  label: string;
  from: ShortcutBinding[];
  to: ShortcutBinding[];
}

// -- Constants ----------------------------------------------------------------

const CHANGE_GROUPS: readonly { label: string; ids: readonly string[] }[] = [
  { label: "Seek", ids: ["global.seekBackward", "global.seekForward"] },
  { label: "Fine seek", ids: ["global.seekBackwardFine", "global.seekForwardFine"] },
  { label: "Nudge words", ids: ["sync.nudgeLeft", "sync.nudgeRight", "timeline.nudgeLeft", "timeline.nudgeRight"] },
  { label: "Snap point jump", ids: ["timeline.jumpPrevSnapPoint", "timeline.jumpNextSnapPoint"] },
  { label: "Word begin / end", ids: ["timeline.setWordBegin", "timeline.setWordEnd"] },
];

const groupOf = new Map(CHANGE_GROUPS.flatMap((group) => group.ids.map((id) => [id, group] as const)));

// -- Helpers ------------------------------------------------------------------

function withBinding(bindings: ShortcutBinding[], binding: ShortcutBinding): ShortcutBinding[] {
  return bindings.some((existing) => bindingsEqual(existing, binding)) ? bindings : [...bindings, binding];
}

// Paired actions (back and forward, Sync and Timeline nudges) read as one row.
function changeRows(
  pick: (id: string, defaultBinding: ShortcutBinding) => [ShortcutBinding, ShortcutBinding] | undefined,
) {
  const rows: ShortcutChange[] = [];
  const rowOfGroup = new Map<string, ShortcutChange>();
  for (const { id, description, defaultBinding } of SHORTCUT_REGISTRY) {
    const picked = pick(id, defaultBinding);
    if (!picked) continue;
    const [from, to] = picked;
    const group = groupOf.get(id);
    const row = group && rowOfGroup.get(group.label);
    if (row) {
      row.ids.push(id);
      row.from = withBinding(row.from, from);
      row.to = withBinding(row.to, to);
      continue;
    }
    const added = { ids: [id], label: group?.label ?? description, from: [from], to: [to] };
    rows.push(added);
    if (group) rowOfGroup.set(group.label, added);
  }
  return rows;
}

function presetChanges(presetId: ShortcutPresetId): ShortcutChange[] {
  return changeRows((id, defaultBinding) => {
    const to = presetBinding(presetId, id);
    return to ? [defaultBinding, to] : undefined;
  });
}

function ownChanges(presetId: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): ShortcutChange[] {
  return changeRows((id, defaultBinding) => {
    const to = overrides[id];
    return to ? [presetBinding(presetId, id) ?? defaultBinding, to] : undefined;
  });
}

// -- Exports ------------------------------------------------------------------

export { ownChanges, presetChanges };
export type { ShortcutChange };
