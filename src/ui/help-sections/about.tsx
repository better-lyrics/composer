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
  <div className="space-y-[22px]">
    <div className="relative -mx-6 -mt-5 border-b border-(--divider)">
      <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_oklab,var(--color-composer-accent)_22%,transparent),transparent_60%)] pointer-events-none" />
      <div className="relative flex items-center gap-5 px-6 pt-7 pb-[26px]">
        <img src="/logo.svg" alt="Composer" className="size-15 shrink-0 drop-shadow-[0_8px_18px_rgb(0_0_0/0.35)]" />
        <div className="flex flex-col min-w-0">
          <h2 className="flex items-center gap-2.5 text-[26px] font-bold tracking-[-0.015em]">
            Composer
            <span className="px-[7px] py-[3px] rounded-[7px] text-xs font-medium font-mono tracking-normal text-composer-accent-text bg-composer-accent/14 shadow-[inset_0_0_0_1px_var(--lit-ring)] select-text">
              v{__APP_VERSION__}
            </span>
          </h2>
          <p className="mt-1 text-sm text-(--label)">The lyrics editor for Better Lyrics.</p>
          <div className="flex items-center gap-2 mt-3.5">
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

    <div className="space-y-[22px] max-w-[68ch]">
      <HelpTopic title="What it is">
        <p className={PROSE}>
          Free and open-source, runs entirely in your browser. No accounts, nothing leaves your machine. Bring your
          audio and lyrics, sync them up, export TTML.
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
        <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
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
  </div>
);

// -- Exports ------------------------------------------------------------------

export { AboutSection };
