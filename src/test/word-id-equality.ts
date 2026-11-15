import { expect } from "vitest";

// -- Types --------------------------------------------------------------------

type Tester = Parameters<typeof expect.addEqualityTesters>[0][number];

// -- Helpers ------------------------------------------------------------------

function isWordShape(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    "sep" in value &&
    "begin" in value &&
    "end" in value
  );
}

// Session ids are random; expectations about ids read them explicitly (`words.map((word) => word.id)`).
const equalApartFromWordIds: Tester = function (a, b, customTesters) {
  if (!isWordShape(a) || !isWordShape(b) || (!("id" in a) && !("id" in b))) return undefined;
  const { id: _a, ...restA } = a;
  const { id: _b, ...restB } = b;
  return this.equals(restA, restB, customTesters);
};

expect.addEqualityTesters([equalApartFromWordIds]);
