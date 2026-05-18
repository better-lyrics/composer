import { HEADING, PROSE } from "@/ui/help-sections/shared";

// -- TTML Standards -----------------------------------------------------------

const TtmlStandardsSection: React.FC = () => (
  <div className="space-y-5">
    <h4 className={HEADING}>What Composer outputs</h4>
    <p className={PROSE}>
      Composer emits{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        TTML 1
      </a>{" "}
      (W3C Recommendation, November 2018). The output is well-formed XML that any TTML 1 conformant parser can read,
      including the standard structure: <code>&lt;tt&gt;</code> root with the TTML namespace, <code>&lt;head&gt;</code>{" "}
      with <code>&lt;ttm:title&gt;</code> and <code>&lt;ttm:agent&gt;</code> declarations, and{" "}
      <code>&lt;body&gt;&lt;div&gt;&lt;p&gt;</code> for lines with <code>&lt;span&gt;</code> per word for word-level
      timing.
    </p>
    <p className={PROSE}>
      Background vocals use <code>ttm:role="x-bg"</code>, which is the spec-sanctioned <code>x-</code> extension prefix
      for custom roles. Singer assignments go through the standard <code>ttm:agent</code> reference.
    </p>

    <h4 className={HEADING}>Foreign-namespace extensions</h4>
    <p className={PROSE}>
      For features that don't have a place in the core TTML 1 vocabulary, like linked groups and per-instance metadata,
      Composer uses the foreign-namespace extension mechanism in{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#extension-vocabulary-overview"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        §5.3.2 Extension Catalog
      </a>{" "}
      of the spec. The spec explicitly permits "arbitrary namespace qualified elements that reside in any namespace
      other than those namespaces defined for use with this specification" and the same for attributes on TTML-defined
      vocabulary. That's the W3C-sanctioned way to add application-specific data while keeping the document conformant.
    </p>
    <p className={PROSE}>
      Composer's namespace URI is <code>https://composer.boidu.dev/ttml</code>. Custom attributes show up as{" "}
      <code>composer:groupId</code>, <code>composer:instanceIdx</code>, and so on, on the root <code>&lt;tt&gt;</code>{" "}
      element and on <code>&lt;p&gt;</code> elements that belong to a linked group. A{" "}
      <code>&lt;composer:groups&gt;</code> block lives inside <code>&lt;metadata&gt;</code> to declare the group
      registry (id, label, color).
    </p>

    <h4 className={HEADING}>Why this matters</h4>
    <p className={PROSE}>
      You can hand a Composer file to any TTML 1 parser and it will work. Tools that don't recognize the{" "}
      <code>composer:</code> namespace can safely skip the extensions: foreign attributes get pruned during validation
      (per{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#document-types"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        §4 Document Types
      </a>
      ) so the document stays valid, and the rest of the file renders normally. The extensions are additive and scoped
      to a clearly identified namespace, so there's no chance of attribute collision with other tools that extend TTML
      for their own purposes.
    </p>

    <h4 className={HEADING}>References</h4>
    <ul className={`${PROSE} list-disc pl-4 space-y-1.5`}>
      <li>
        <a
          href="https://www.w3.org/TR/2018/REC-ttml1-20181108/"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          TTML 1 W3C Recommendation
        </a>{" "}
        (the spec)
      </li>
      <li>
        <a
          href="https://github.com/w3c/ttml1"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          W3C TTML 1 repository
        </a>{" "}
        (issues, errata, source)
      </li>
      <li>
        <a
          href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#extension-vocabulary-overview"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          §5.3.2 Extension Catalog
        </a>{" "}
        (the section that permits foreign-namespace extensions)
      </li>
      <li>
        <a
          href="https://github.com/w3c/ttml1/issues/251"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          w3c/ttml1#251
        </a>{" "}
        (Working Group discussion clarifying that vocabulary the spec doesn't define gets pruned before validation, so
        documents stay valid)
      </li>
    </ul>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TtmlStandardsSection };
