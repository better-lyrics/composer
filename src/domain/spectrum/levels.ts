// -- Constants -------------------------------------------------------------

const DB_RANGE = 120;
const CEILING_DB = -8;

// -- Functions -------------------------------------------------------------

function encodeDb(db: number): number {
  return Math.max(0, Math.min(255, Math.round(((db + DB_RANGE) * 255) / DB_RANGE)));
}

function decodeDb(level: number): number {
  return (level * DB_RANGE) / 255 - DB_RANGE;
}

function brightness(db: number, floorDb: number): number {
  return Math.min(1, Math.max(0, (db - floorDb) / (CEILING_DB - floorDb)));
}

// -- Exports ---------------------------------------------------------------

export { brightness, decodeDb, encodeDb };
