import { describe, expect, it } from "vitest";
import { type XmlElement, writeXmlElement } from "./xml-node";

describe("writeXmlElement", () => {
  it("writes an element back with its attributes in source order", () => {
    const element: XmlElement = {
      name: "songwriters",
      attrs: [],
      children: [
        { name: "songwriter", attrs: [["x-vendor:role", "lyrics & music"]], children: [{ text: "Mara Quill" }] },
      ],
    };
    expect(writeXmlElement(element)).toBe(
      '<songwriters><songwriter x-vendor:role="lyrics &amp; music">Mara Quill</songwriter></songwriters>',
    );
  });
});
