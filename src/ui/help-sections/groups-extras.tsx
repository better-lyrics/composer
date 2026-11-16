import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SettingLink } from "@/ui/setting-link";
import { INLINE_CODE, PROSE } from "@/ui/typography";

// -- Linked group extras ------------------------------------------------------

const GroupsExtras: React.FC = () => (
  <>
    <HelpTopic title="What propagates and what doesn't">
      <p className={PROSE}>Linked across all instances:</p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>Word text and line text edits.</li>
        <li>Agent assignments.</li>
        <li>Background vocal text.</li>
        <li>
          Word splits and merges. Every instance gets the new words, and each one keeps the timing of the words that
          didn't change.
        </li>
        <li>Moving a word between main and background tracks.</li>
      </ul>
      <p className={`${PROSE} mt-2`}>Stays local to one instance:</p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>Absolute begin and end times, except in a group that shares timing (below).</li>
        <li>
          Banner shifts and nudges with <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeLeft")} /> and{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeRight")} />.
        </li>
        <li>Anything you do on a line that's been detached.</li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Shared timing">
      <p className={PROSE}>
        New groups share their timing. Sync one chorus and the others follow, each from its own start. Change the timing
        of one and the others change too, and their banners pulse to show it. Turn this off for new groups in{" "}
        <SettingLink setting="shareTimingInNewGroups" />.
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1 mt-2`}>
        <li>
          <strong>Placing an instance</strong>: an instance with no timing yet needs a start. In Sync, one tap on its
          first word places the whole instance and skips ahead, starting playback a little before the next line (set in{" "}
          <SettingLink setting="redoPreroll" />
          ). In the Timeline, right-click one of its lines and pick <strong>Place at playhead</strong>.
        </li>
        <li>
          <strong>One instance differs</strong>: right-click its banner and pick <strong>Use own timing</strong>. Its
          banner shows an Own timing chip, and <strong>Share timing</strong> brings it back.
        </li>
        <li>
          <strong>Song edges</strong>: a shared edit stops if it would push an instance past the start or end of the
          song.
        </li>
        <li>
          <strong>Older groups</strong> keep their own timing. Right-click a banner and pick{" "}
          <strong>Share timing across group</strong>, or accept the suggestion in the Timeline header.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Open a group">
      <p className={PROSE}>
        Double-click a banner, or select it and press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.openGroup")} />, to see one instance on its own, zoomed to
        fit. Close it and your zoom comes back. The strip at the top names the instance. Step to the other shared
        instances with its arrows, or with <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevInstance")} />{" "}
        and <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextInstance")} />. The playhead keeps its spot in
        the instance. Edits still reach every shared instance.
      </p>
      <p className={`${PROSE} mt-2`}>
        Playback stays inside the instance, on every tab. Play starts at its first word, and at its end playback stops
        and goes back to the start. Turn on <strong>Loop</strong> in the strip to keep it repeating. From any tab,{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("global.toggleLoop")} /> does the same. On the Timeline tab, with
        timed words selected, it loops just those words. The waveform and the seek bar shade everything outside the
        instance, and Preview fades the other lines.
      </p>
      <p className={`${PROSE} mt-2`}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.closeGroup")} /> or click <strong>Done</strong> to
        go back to the song.
      </p>
    </HelpTopic>

    <HelpTopic title="When one instance differs">
      <p className={PROSE}>
        A split or merge on a linked line reaches every instance right away. The first time a split reaches other
        instances, a notice says how many instances have it now, with Undo.
      </p>
      <p className={`${PROSE} mt-2`}>
        When one edit gives the same line different text in two instances, such as a pasted song whose last chorus adds
        a word, the first changed instance in the song sets the group's text. Instances that got the same text stay
        linked, and any instance given different text keeps it and stops following the group. Breaking, joining, or
        deleting lines inside an instance makes the lines it changes stop following the group, for that instance only. A
        notice names the line that now differs, with Undo.
      </p>
    </HelpTopic>

    <HelpTopic title="Detaching">
      <p className={PROSE}>
        Real songs aren't perfectly repetitive. The last chorus might add an extra "yeah" or land on a different agent.
        Two ways to break the link:
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
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
        Both are undoable: the toast that appears has an Undo button, or press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("global.undo")} />.
      </p>
    </HelpTopic>

    <HelpTopic title="Emptying an instance">
      <p className={PROSE}>
        Click the banner to select every word in an instance, then press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.deleteSelection")} />. Composer clears the timed content
        and notices the instance is now empty across all its lines, so it strips the group attrs from those rows
        automatically. You're left with empty placeholders that the fill flow above can repopulate later. The other
        instances of the group are untouched.
      </p>
      <p className={`${PROSE} mt-2`}>
        Partial deletes don't trigger this: if one line of a multi-line instance still has timed words, the instance
        stays linked.
      </p>
    </HelpTopic>

    <HelpTopic title="Deleting a group">
      <p className={PROSE}>
        Right-click any banner and pick <strong>Delete group</strong>. A confirmation modal warns you that all instances
        will become standalone (text and timing survive, they just stop syncing). Tick "Don't ask again" to skip the
        modal next time, or restore the prompt from <SettingLink setting="confirmGroupDissolution" />.
      </p>
    </HelpTopic>

    <HelpTopic title="How groups look outside the Timeline">
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>
          <strong>Edit view</strong>: a header row with the group name and the instance number (such as 2 of 3) appears
          before each instance. Grouped lines get a light tint in the group color and a hover tooltip showing the link
          count.
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
    </HelpTopic>
  </>
);

// -- Exports ------------------------------------------------------------------

export { GroupsExtras };
