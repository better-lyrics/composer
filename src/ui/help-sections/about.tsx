import { PROSE, PROSE_LINK } from "@/ui/typography";
import { HelpTopic } from "@/ui/help-topic";
import { LinkButton } from "@/ui/link-button";
import { IconBrandDiscord, IconBrandGithub, IconBug } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const GITHUB_URL = "https://github.com/better-lyrics/composer";
const DISCORD_URL = "https://discord.gg/UsHE3d5fWF";
const ISSUE_URL = "https://github.com/better-lyrics/composer/issues/new/choose";

// -- About --------------------------------------------------------------------

const AboutSection: React.FC = () => (
  <div className="space-y-5">
    <div className="relative -mx-6 -mt-6 border-b border-(--divider)">
      <div className="absolute inset-0 bg-gradient-to-b from-composer-accent/14 to-transparent pointer-events-none" />
      <div className="relative flex items-center gap-5 px-6 pt-7 pb-6">
        <img src="/logo.svg" alt="Composer" className="size-15 shrink-0" />
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="flex items-center gap-2.5 text-[28px] font-bold leading-tight tracking-[-0.015em]">
            Composer
            <span className="px-1.5 py-px rounded-md text-xs font-medium font-mono text-composer-accent-text bg-composer-accent/14 shadow-[inset_0_0_0_1px_var(--lit-ring)]">
              v{__APP_VERSION__}
            </span>
          </h2>
          <p className="text-sm text-(--label)">The lyrics editor for Better Lyrics.</p>
          <div className="flex items-center gap-2 mt-3">
            <LinkButton href={GITHUB_URL} external variant="secondary" size="lg" hasIcon>
              <IconBrandGithub aria-hidden="true" className="size-4" />
              GitHub
            </LinkButton>
            <LinkButton href={DISCORD_URL} external variant="secondary" size="lg" hasIcon>
              <IconBrandDiscord aria-hidden="true" className="size-4" />
              Discord
            </LinkButton>
            <LinkButton href={ISSUE_URL} external variant="ghost" size="lg" hasIcon>
              <IconBug aria-hidden="true" className="size-4" />
              File an issue
            </LinkButton>
          </div>
        </div>
      </div>
    </div>

    <HelpTopic title="What it is">
      <p className={PROSE}>
        Free and open-source, runs entirely in your browser. No accounts, nothing leaves your machine. Bring your audio
        and lyrics, sync them up, export TTML.
      </p>
    </HelpTopic>

    <HelpTopic title="Open source">
      <p className={PROSE}>
        AGPL v3. Source on{" "}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
          GitHub
        </a>
        . PRs welcome if you spot something to fix.
      </p>
    </HelpTopic>

    <HelpTopic title="Commercial use">
      <p className={PROSE}>
        Composer is also available under a commercial license that removes the AGPL copyleft obligations and covers
        commercial use of its output, such as a label or distributor publishing generated lyrics in a release. For
        commercial or enterprise licensing, reach out to{" "}
        <a href="mailto:composer@boidu.dev" className={PROSE_LINK}>
          composer@boidu.dev
        </a>
        .
      </p>
    </HelpTopic>

    <HelpTopic title="Community">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
            Discord
          </a>{" "}
          for questions and chat.
        </li>
        <li>
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
            File an issue
          </a>{" "}
          if something's broken.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Made by">
      <p className={PROSE}>
        <a href="https://boidu.dev" target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
          Boidu
        </a>
        , with thanks to everyone in the{" "}
        <a href="https://betterlyrics.org" target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
          Better Lyrics
        </a>{" "}
        community who's tested it, reported bugs, and put up with the rough edges.
      </p>
    </HelpTopic>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { AboutSection };
