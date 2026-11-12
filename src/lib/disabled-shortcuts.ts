import { toast } from "@/utils/toast";

// -- Types ---------------------------------------------------------------------

interface Hold {
  reason?: string;
}

// -- State ---------------------------------------------------------------------

const holds = new Map<string, Set<Hold>>();

// -- Functions -----------------------------------------------------------------

function disableShortcut(id: string, reason?: string): () => void {
  const hold: Hold = { reason };
  const idHolds = holds.get(id) ?? new Set<Hold>();
  idHolds.add(hold);
  holds.set(id, idHolds);
  return () => {
    idHolds.delete(hold);
    if (idHolds.size === 0 && holds.get(id) === idHolds) holds.delete(id);
  };
}

function isShortcutDisabled(id: string): boolean {
  return holds.has(id);
}

function announceDisabledShortcut(id: string): void {
  const reason = [...(holds.get(id) ?? [])].findLast((hold) => hold.reason !== undefined)?.reason;
  if (reason !== undefined) toast.info(reason, { id: `disabled-shortcut:${id}` });
}

// -- Exports -------------------------------------------------------------------

export { announceDisabledShortcut, disableShortcut, isShortcutDisabled };
