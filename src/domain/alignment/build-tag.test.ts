import { describe, expect, it } from "vitest";
import { readBuildTag, withBuildTag } from "@/domain/alignment/build-tag";

// -- Fixtures -----------------------------------------------------------------

const TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:composer="https://composer.betterlyrics.org/ttml" composer:timing="Word"><body><div>' +
  '<p begin="0:01.000" end="0:02.000"><span begin="0:01.000" end="0:01.500">Lanterns </span><span begin="0:01.500" end="0:02.000">drift</span></p>' +
  "</div></body></tt>";

const TAG = { untouched: 22, heard: 18, fixed: 12, handSynced: 6, handEdited: false };

function tagValue(ttml: string): string {
  return ttml.match(/composer:build="([0-9a-z]{8})"/)?.[1] ?? "";
}

// -- Tests --------------------------------------------------------------------

describe("build tag", () => {
  it("round-trips the counts and flag through the root element", () => {
    const tagged = withBuildTag(TTML, TAG);
    expect(tagged).toMatch(/^<tt [^>]* composer:build="[0-9a-z]{8}">/);
    expect(readBuildTag(tagged)).toEqual(TAG);
  });

  it("reads a changed character or a tag moved to another song as nothing", () => {
    const value = tagValue(withBuildTag(TTML, TAG));
    const flipped = value.slice(0, 7) + (value[7] === "a" ? "b" : "a");
    expect(readBuildTag(withBuildTag(TTML, TAG).replace(value, flipped))).toBeNull();

    const otherSong = TTML.replace("</div>", '<p begin="0:03.000" end="0:04.000">Home</p></div>');
    const moved = withBuildTag(otherSong, TAG).replace(tagValue(withBuildTag(otherSong, TAG)), value);
    expect(readBuildTag(moved)).toBeNull();
  });
});
