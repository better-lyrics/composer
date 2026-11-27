import type { ModelPhone } from "@/audio/alignment/hubertfa/readers/donors";
import { parsePhoneTable, tableDictionaryPhones, tableSoundPhones } from "@/audio/alignment/hubertfa/readers/phone-table";
import tableJson from "@/audio/alignment/hubertfa/readers/test-fixtures/hubertfa_pt_mf_phones_v1.json";
import fixture from "@/audio/alignment/hubertfa/readers/test-fixtures/mf-phones.json";
import { buildPhoneSequence } from "@/audio/alignment/hubertfa/sequence";
import { describe, expect, it } from "vitest";

const table = parsePhoneTable(tableJson);

// A fixture word's sounds are a reader's, or one dictionary's vocabulary keys ("ja/k", "en/ow").
function phonesOf(sounds: readonly string[]): ModelPhone[] {
  if (!sounds[0]?.includes("/")) return tableSoundPhones(table, sounds);
  const language = sounds[0].split("/")[0];
  const bare = sounds.map((sound) => sound.slice(sound.indexOf("/") + 1));
  if (language === "zh" || language === "ja") return tableDictionaryPhones(table, language, bare);
  return bare.map((phone) => ({ language: "en", phone }));
}

function rowsOf(phones: ModelPhone[]): number[] {
  const built = buildPhoneSequence([{ parts: [0], phones }], table.rows);
  if (built.kind !== "sequence") return [];
  const { phoneIds, unitOf } = built.sequence;
  return [...phoneIds].filter((_, k) => unitOf[k] === 0);
}

describe("a model's phone table", () => {
  it("gives every word the phones and output rows the multilingual model was trained on", () => {
    const wrong = fixture.words.flatMap(({ language, text, sounds, phones, rows }) => {
      const got = phonesOf(sounds);
      const keys = got.map((phone) => `${phone.language}/${phone.phone}`);
      const gotRows = rowsOf(got);
      if (keys.join(" ") === phones.join(" ") && gotRows.join(" ") === rows.join(" ")) return [];
      return [`${language} ${text}: ${keys.join(" ")} [${gotRows}], expected ${phones.join(" ")} [${rows}]`];
    });
    expect(wrong).toEqual([]);
  });

  it("refuses a key that is neither in the vocabulary nor on a row of its own", () => {
    expect(() => parsePhoneTable({ ...tableJson, sounds: { a: ["en/_nope"] } })).toThrow(/en\/_nope/);
  });
});
