import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { groupAnchorId, RuleList } from "@/best-practices/rule-list";

// -- Table of contents ---------------------------------------------------------

const GuideContents: React.FC = () => (
  <nav aria-label="On this page" className="mb-10">
    <p className="font-mono text-xs text-composer-text-faint mb-3">On this page</p>
    <ul className="space-y-1.5">
      {BEST_PRACTICE_GROUPS.map((group) => (
        <li key={group.id}>
          <a href={`#${groupAnchorId(group.id)}`} className="text-sm text-composer-text-muted hover:text-composer-text">
            {group.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

// -- Guide ---------------------------------------------------------------------

const LyricBestPracticesContent: React.FC = () => (
  <>
    <p>
      Seventeen conventions for lyric files people actually enjoy reading along to. The format requires none of them.
      The good files follow them anyway.
    </p>
    <p>
      TTML will take a file that breaks every rule here and Better Lyrics will render it without complaint. What it
      changes is whether people enjoy reading along, or find the file quietly annoying in a way they can't name.
    </p>

    <GuideContents />

    <RuleList />
  </>
);

// -- Exports -------------------------------------------------------------------

export default LyricBestPracticesContent;
