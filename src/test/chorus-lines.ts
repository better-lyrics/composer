import { createLine } from "@/test/factories";

// -- Fixtures -----------------------------------------------------------------

// "I want" in group g1, word timed from `begin` when given.
const chorus = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I", sep: " ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

// -- Exports ------------------------------------------------------------------

export { chorus };
