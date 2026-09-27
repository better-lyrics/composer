import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { PROSE } from "@/ui/typography";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { HelpTopic } from "@/ui/help-topic";

// -- Recovery -----------------------------------------------------------------

const RecoverySection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      Composer saves your work as you go. If the app crashes, freezes, or you accidentally close the tab, your lyrics
      and timing are still there. Here's how to get them back.
    </p>

    <HelpTopic title="The app showed an error">
      <p className={PROSE}>
        Hit <strong>Download my work</strong> on the error screen. You'll get a project file. Reload Composer, head to
        the Export tab, and click <strong>Import Project</strong> to pick up where you left off.
      </p>
    </HelpTopic>

    <HelpTopic title="The app is frozen">
      <p className={PROSE}>
        Open{" "}
        <a
          href="/recover"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          /recover
        </a>{" "}
        in a new tab. It's a tiny page that fetches your work without loading anything else, so it still works when
        nothing else does. Worth bookmarking.
      </p>
    </HelpTopic>

    <HelpTopic title="Shortcut">
      <p className={PROSE}>
        <InlineKeyBadge keys={getEffectiveKeysArray("global.panicRecovery")} /> downloads your work from anywhere in the
        app. Handy when things look weird but aren't fully stuck. If the whole tab is frozen, use the /recover tab
        approach instead.
      </p>
    </HelpTopic>

    <HelpTopic title="What's in the backup">
      <p className={PROSE}>
        Lyrics, timing, agents, groups, and project metadata. Audio doesn't carry over (files are too big), so you'll
        drop that back in yourself. Everything stays on your device, nothing's uploaded.
      </p>
    </HelpTopic>

    <HelpTopic title="Nothing showed up?">
      <p className={PROSE}>
        Backups are tied to the browser you used. They won't show up in a different browser, a different profile, or a
        private window. If you cleared browser data after the crash, sadly it's gone.
      </p>
    </HelpTopic>

    <HelpTopic title="Still crashing after reload?">
      <p className={PROSE}>
        Sometimes the saved data itself is the issue. After downloading the backup, the same screen (error page or
        /recover) shows a <strong>Clear saved data</strong> button. It wipes the autosave so Composer opens fresh next
        time. Import the file back whenever you're ready. If you can still get into the app, the Export tab's{" "}
        <strong>Clear</strong> button does the same thing.
      </p>
    </HelpTopic>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { RecoverySection };
