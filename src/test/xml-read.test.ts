import { readFileSync } from "node:fs";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";
import { generateProjectTtml } from "insync/ttml/write";
import { readXmlDocument } from "insync/ttml/xml-read";
import { describe, expect, it } from "vitest";
import { EDITED_TTML_PROJECTS } from "@/test/edited-ttml-projects";
import {
  buildAlternateBackgroundLanguageTtml,
  buildAlternateLanguageTtml,
  buildBackgroundVocalTtml,
  buildMatchingAlternateLanguageTtml,
  buildSyncedTtml,
} from "@/test/ttml-fixtures";
import { FOREIGN_TTML_FIXTURES } from "@/test/ttml-foreign-fixtures";
import { exportOfImport } from "@/test/ttml-unmodelled";
import { xmlTreeFromDom, xmlTreeFromRead } from "@/test/xml-tree";

// -- Constants ----------------------------------------------------------------

const EXPORT_DURATION_SECONDS = 30;

const REAL_TTML_FILES = process.env.INSYNC_REAL_TTML?.split("\n").filter(Boolean) ?? [];

const COMPOSER_TTML_FIXTURES: readonly (readonly [name: string, ttml: string])[] = [
  ["synced", buildSyncedTtml(EXPORT_DURATION_SECONDS)],
  ["background vocals", buildBackgroundVocalTtml()],
  ["alternate languages", buildAlternateLanguageTtml()],
  ["alternate background languages", buildAlternateBackgroundLanguageTtml()],
  ["matching alternate languages", buildMatchingAlternateLanguageTtml()],
  ...EDITED_TTML_PROJECTS.map((build) => {
    const project = build();
    const ttml = generateProjectTtml(project, EXPORT_DURATION_SECONDS, DEFAULT_SPLIT_CHARACTER);
    return [`edited ${project.name}`, ttml] as const;
  }),
];

// What well-formed XML forbids and the validator alone lets through, plus the markup real files hold.
const MARKUP_CASES: readonly (readonly [name: string, xml: string])[] = [
  ["entities and references", `<tt a="x&#10;y&#x9;&amp;&lt;&quot;" b='&apos;'>a&#x41;&#66;&gt;&#128512;</tt>`],
  ["literal whitespace in an attribute", `<tt a="one\ntwo\tthree\r\nfour"/>`],
  ["line breaks", "<tt>\r\n<p>a\rb</p>\r\n</tt>"],
  ["cdata and comments", "<tt><p>a<![CDATA[<b>&amp;]]>c<!-- note --></p></tt>"],
  [
    "declaration, doctype entity and instruction",
    `<?xml version="1.0"?>\n<!DOCTYPE tt [<!ENTITY s "sing">]>\n<tt><?pi data?><p>&s;</p></tt>`,
  ],
  [
    "default and prefixed namespaces",
    `<tt xmlns="urn:a" xmlns:x="urn:x"><x:p x:k="1" k="2"><q xmlns="">t</q></x:p></tt>`,
  ],
  ["xml prefix", `<tt xml:lang="en"><p xml:id="a"/></tt>`],
  ["two roots", "<a/><b/>"],
  ["text after the root", "<a/>text"],
  ["undeclared entity", "<a>&nbsp;</a>"],
  ["undeclared prefix", "<a><x:b/></a>"],
  ["undeclared attribute prefix", `<a x:b="1"/>`],
  ["empty prefix declaration", `<a xmlns:p=""/>`],
  ["bare ampersand", "<a>x & y</a>"],
  ["bare ampersand in an attribute", `<a b="x & y"/>`],
  ["less-than in an attribute", `<a b="<"/>`],
  ["cdata end in text", "<a>]]></a>"],
  ["double hyphen in a comment", "<a><!-- a -- b --></a>"],
  ["null character reference", "<a>&#0;</a>"],
  ["two colons in a name", "<a:b:c xmlns:a='urn:a'/>"],
  ["unclosed element", "<a><b></a>"],
  ["duplicate attribute", `<a b="1" b="2"/>`],
  ["empty", ""],
];

// -- Helpers ------------------------------------------------------------------

function domTree(source: string) {
  const doc = new DOMParser().parseFromString(source, "text/xml");
  return doc.querySelector("parsererror") ? "not well-formed" : xmlTreeFromDom(doc.documentElement);
}

function parserTree(source: string) {
  const read = readXmlDocument(source);
  return read.ok ? xmlTreeFromRead(read.doc.documentElement) : "not well-formed";
}

const roundTrips = FOREIGN_TTML_FIXTURES.map(([name, ttml]) => [`${name}, exported`, exportOfImport(ttml)] as const);

// -- Tests --------------------------------------------------------------------

describe("xml reader", () => {
  it("builds the tree the DOM builds for every foreign and Composer fixture", () => {
    for (const [name, source] of [...FOREIGN_TTML_FIXTURES, ...roundTrips, ...COMPOSER_TTML_FIXTURES]) {
      expect(parserTree(source), name).toEqual(domTree(source));
    }
  });

  it("reads and refuses markup as the DOM does", () => {
    for (const [name, source] of MARKUP_CASES) expect(parserTree(source), name).toEqual(domTree(source));
  });

  it.runIf(REAL_TTML_FILES.length > 0)("builds the tree the DOM builds for every real file", () => {
    const differing = REAL_TTML_FILES.filter((path) => {
      const source = readFileSync(path, "utf8");
      return JSON.stringify(parserTree(source)) !== JSON.stringify(domTree(source));
    });
    expect(differing).toEqual([]);
  });
});
