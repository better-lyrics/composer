import { nanoid } from "nanoid";

// -- Interfaces ---------------------------------------------------------------

interface Row {
  id: string;
  value: string;
}

// -- Reconciliation -----------------------------------------------------------

const seedRows = (values: string[]): Row[] => values.map((value) => ({ id: nanoid(), value }));

const reconcileRows = (previous: Row[], values: string[]): Row[] =>
  values.map((value, index) =>
    previous[index]?.value === value ? previous[index] : { id: previous[index]?.id ?? nanoid(), value },
  );

const sameStrings = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

// -- Exports ------------------------------------------------------------------

export { seedRows, reconcileRows, sameStrings };
export type { Row };
