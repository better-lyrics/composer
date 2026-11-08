// -- Constants -----------------------------------------------------------------

const SYNC_TYPE_LABELS: Record<string, string> = {
  richsync: "Word synced",
  linesync: "Line synced",
  plain: "Plain text",
};

// -- Functions -----------------------------------------------------------------

function unisonSyncLabel(syncType: string): string {
  return SYNC_TYPE_LABELS[syncType] ?? SYNC_TYPE_LABELS.plain;
}

// -- Exports -------------------------------------------------------------------

export { unisonSyncLabel };
