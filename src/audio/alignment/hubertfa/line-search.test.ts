import type { PhoneUnit } from "@/audio/alignment/hubertfa/g2p";
import { alignPhones, lineFeeds, linesAround } from "@/audio/alignment/hubertfa/line-search";
import { parsePhoneTable } from "@/audio/alignment/hubertfa/readers/phone-table";
import mfPhones from "@/audio/alignment/hubertfa/readers/test-fixtures/hubertfa_pt_mf_phones_v1.json";
import { buildPhoneSequence } from "@/audio/alignment/hubertfa/sequence";
import vocab from "@/audio/alignment/hubertfa/vocab.json";
import type { LineRequest } from "@/audio/alignment/hubertfa/worker-protocol";
import type { Ort, OrtTensor } from "@/audio/ort-runtime";
import { describe, expect, it } from "vitest";

const { rows } = parsePhoneTable(mfPhones);
const FRAMES = 200;
const SAMPLE_RATE = 44100;
// A pure o: one of the multilingual model's own keys, on the row of ja/o.
const unit = (phone: string): PhoneUnit => ({ parts: [0], phones: [{ language: "en", phone }] });
const request: LineRequest = {
  samples: new Float32Array(FRAMES * 441),
  sampleRate: SAMPLE_RATE,
  words: [["no"]],
  hanReading: "zh",
  latinReader: "es",
  transliteration: null,
  context: { previous: [["si"]], next: [["no"]] },
  wide: true,
};
const tensor = (data: Float32Array, dims: number[]): OrtTensor => ({ data, dims });
const ort = {
  Tensor: class {
    constructor(
      readonly type: string,
      readonly data: BigInt64Array | Float32Array,
      readonly dims: number[],
    ) {}
  },
} as unknown as Ort;

async function contextOf(previous: PhoneUnit, next: PhoneUnit) {
  const prepared = { kind: "ready", units: [previous] };
  return linesAround(request, async (words) => (words[0][0] === "si" ? prepared : { kind: "ready", units: [next] }), rows);
}

describe("a line among its neighbours, on a model with a phone table", () => {
  it("regression: aligns a line whose phones and neighbours hold the table's own keys", async () => {
    const own = buildPhoneSequence([unit("n"), unit("_o")], rows);
    if (own.kind !== "sequence") throw new Error(`no sequence: ${own.kind}`);
    const context = await contextOf(unit("_o"), unit("_o"));
    const outputs = {
      ph_frame_logits: tensor(new Float32Array(vocab.vocab_size * FRAMES), [1, vocab.vocab_size, FRAMES]),
      ph_edge_logits: tensor(new Float32Array(FRAMES), [1, FRAMES]),
      line_logits: tensor(new Float32Array(FRAMES), [1, FRAMES]),
    };
    const placed = alignPhones([unit("n"), unit("_o")], own.sequence, context, request, outputs);
    expect(placed?.map((phone) => phone.index)).toEqual([1, 3]);
  });

  it("regression: gives the model the neighbours' table keys as their rows", async () => {
    const own = buildPhoneSequence([unit("n")], rows);
    if (own.kind !== "sequence") throw new Error(`no sequence: ${own.kind}`);
    const feeds = lineFeeds(ort, own.sequence, await contextOf(unit("_o"), unit("_u")), undefined);
    const row = (key: string) => vocab.vocab[key as keyof typeof vocab.vocab];
    const sep = vocab.vocab_size + 2;
    expect(Array.from(feeds.ph_ids.data as unknown as BigInt64Array, Number)).toEqual([
      row("ja/o"),
      sep,
      row("en/n"),
      sep,
      row("ja/u"),
    ]);
  });
});
