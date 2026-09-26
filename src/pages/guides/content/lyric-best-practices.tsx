import { groupAnchorId } from "@/best-practices/anchors";
import { BEST_PRACTICE_GROUPS } from "@/best-practices/groups";
import { RuleList } from "@/best-practices/rule-list";

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
      None of this is in the TTML spec. It is the set of habits good lyric files share, written down so you don't have
      to work them out by reading other people's files.
    </p>
    <p>
      Break every rule here and the file still validates, and Better Lyrics still renders it. It just reads worse: lines
      that outstay the vocal, backing parts you mistake for the lead.
    </p>

    <GuideContents />

    <RuleList />
  </>
);

// -- Exports -------------------------------------------------------------------

export default LyricBestPracticesContent;
