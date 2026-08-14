import { HEADING, INLINE_CODE, PROSE } from "@/ui/help-sections/shared";
import { MOD_KEY } from "@/utils/platform";

// -- Linked group extras ------------------------------------------------------

const GroupsExtras: React.FC = () => (
  <>
    <div>
      <h4 className={HEADING}>What propagates and what doesn't</h4>
      <p className={PROSE}>Linked across all instances:</p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Word text and line text edits.</li>
        <li>Agent assignments.</li>
        <li>Background vocal text.</li>
        <li>
          Word splits and merges. Siblings get the new word structure, and Composer keeps the timing of every word that
          didn't actually change. Only the split or merged word's slot is divided up. Sibling rhythms you carefully
          synced earlier survive.
        </li>
        <li>Moving a word between main and background tracks.</li>
      </ul>
      <p className={`${PROSE} mt-2`}>Stays local to one instance:</p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Absolute begin and end times for each word.</li>
        <li>Banner shifts and arrow-key nudge.</li>
        <li>Anything you do on a line that's been detached.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>The split-or-merge prompt</h4>
      <p className={PROSE}>
        When a split or merge on a linked line would actually shift sibling word timings (sibling rhythms differ from
        the source), Composer pops a three-button modal: <strong>Apply to all</strong> (propagate with timing
        preservation), <strong>Detach</strong> (keep the change on this line only, unlink it from the group), or{" "}
        <strong>Cancel</strong>. The modal stays out of the way when sibling rhythms already match the source, since
        propagation is a no-op for the unchanged words anyway.
      </p>
      <p className={`${PROSE} mt-2`}>
        Tick "Don't ask again" in the modal to default to your choice next time. Reset the preference from{" "}
        <strong>Settings → Confirmations</strong>.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Detaching</h4>
      <p className={PROSE}>
        Real songs aren't perfectly repetitive. The last chorus might add an extra "yeah" or land on a different agent.
        Two ways to break the link:
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Right-click a line in the gutter and pick <strong>Detach this line</strong>. That single line stops syncing
          with siblings; everything else stays linked.
        </li>
        <li>
          Right-click the banner and pick <strong>Detach instance</strong>. The whole instance becomes plain standalone
          lines. Other instances keep their group.
        </li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        Both are undoable: the toast that appears has an Undo button, or press {MOD_KEY} + Z.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Emptying an instance</h4>
      <p className={PROSE}>
        Click the banner to select every word in an instance, then press <strong>Delete</strong>. Composer clears the
        timed content and notices the instance is now empty across all its lines, so it strips the group attrs from
        those rows automatically. You're left with empty placeholders that the fill flow above can repopulate later. The
        other instances of the group are untouched.
      </p>
      <p className={`${PROSE} mt-2`}>
        Partial deletes don't trigger this: if one line of a multi-line instance still has timed words, the instance
        stays linked.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Deleting a group</h4>
      <p className={PROSE}>
        Right-click any banner and pick <strong>Delete group</strong>. A confirmation modal warns you that all instances
        will become standalone (text and timing survive, they just stop syncing). Tick "Don't ask again" to skip the
        modal next time, or restore the prompt from <strong>Settings → Confirmations</strong>.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>How groups look outside the Timeline</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Edit view</strong>: a colored divider with the group name and instance count appears before each
          instance, plus a thin closing line at the end. Each grouped line also gets a left-edge stripe in the group
          color and a hover tooltip showing the link count.
        </li>
        <li>
          <strong>Sync view</strong>: the gutter cell shows a chain icon and an instance counter so you know which
          chorus you're syncing.
        </li>
        <li>
          <strong>TTML export</strong>: groups round-trip via a custom{" "}
          <span className={INLINE_CODE}>composer:groups</span> registry plus per-line attributes. Other TTML players
          ignore them; Composer reads them back exactly as saved.
        </li>
      </ul>
    </div>
  </>
);

// -- Exports ------------------------------------------------------------------

export { GroupsExtras };
