import amllTtml from "@/test/fixtures/ttml/amll.ttml?raw";
import storeDialectTtml from "@/test/fixtures/ttml/store-dialect.ttml?raw";
import vendorTtml from "@/test/fixtures/ttml/vendor.ttml?raw";

// -- Fixtures -----------------------------------------------------------------

// Invented lyrics in the structures other tools write: song parts, vendor data, ruby, undeclared prefixes.
const FOREIGN_TTML_FIXTURES: readonly (readonly [name: string, ttml: string])[] = [
  ["store dialect with song parts and songwriters", storeDialectTtml],
  ["amll with undeclared prefixes", amllTtml],
  ["vendor data on every node, ruby and kept elements", vendorTtml],
];

// -- Exports ------------------------------------------------------------------

export { FOREIGN_TTML_FIXTURES };
