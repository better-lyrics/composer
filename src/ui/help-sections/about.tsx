import { IconBrandDiscord, IconBrandGithub, IconBug, IconHeart, IconStar } from "@tabler/icons-react";
import { AboutCredits } from "@/ui/help-sections/about-credits";
import { HelpTopic } from "@/ui/help-topic";
import { LinkButton } from "@/ui/link-button";
import { PROSE, PROSE_LINK } from "@/ui/typography";
import { BRIDGE_REPO_URL } from "@/utils/composer-bridge-api";

// -- Interfaces ---------------------------------------------------------------

interface Maker {
  name: string;
  href: string;
  avatar: string;
}

// -- Constants ----------------------------------------------------------------

const GITHUB_URL = "https://github.com/better-lyrics/composer";
const DISCORD_URL = "https://discord.gg/UsHE3d5fWF";
const ISSUE_URL = "https://github.com/better-lyrics/composer/issues/new/choose";
const CONTRIBUTORS_URL = "https://github.com/better-lyrics/composer#contributors";
const DOCS_URL = "https://docs.betterlyrics.org";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/boidu";
const GITHUB_SPONSORS_URL = "https://github.com/sponsors/boidushya";

const MAKERS = {
  boidu: { name: "Boidu", href: "https://boidu.dev", avatar: "/credits/boidushya.jpg" },
  adalie: { name: "Adalie", href: "https://adalie.me", avatar: "/credits/adaliea.jpg" },
} satisfies Record<string, Maker>;

// -- Components ---------------------------------------------------------------

const MakerLink: React.FC<{ maker: Maker }> = ({ maker }) => (
  <a href={maker.href} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
    <img
      src={maker.avatar}
      alt=""
      className="inline-block size-4 mr-[5px] align-[-3px] rounded-[4px] object-cover outline outline-white/8 -outline-offset-1 shadow-[0_1px_1px_rgb(0_0_0/0.25),0_2px_3px_rgb(0_0_0/0.2),0_4px_8px_rgb(0_0_0/0.12)]"
    />
    {maker.name}
  </a>
);

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
          Free and open-source, runs entirely in your browser. No accounts, and your projects and audio stay on your
          machine. Only lyrics search, song details, translation, transliteration and YouTube links reach a server.
          Bring your audio and lyrics, sync them up, export TTML.
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
          <li>
            <a href={BRIDGE_REPO_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
              Composer Bridge
            </a>{" "}
            to load YouTube links through your own machine.
          </li>
          <li>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
              Docs
            </a>{" "}
            for the Better Lyrics API and Braccato, the renderer behind Preview.
          </li>
        </ul>
      </HelpTopic>

      <AboutCredits />

      <HelpTopic title="Support">
        <p className={PROSE}>
          Composer is free, hosted or self-hosted, and it'll stay that way. If it's saved you time, a coffee or a
          sponsorship helps keep it going. A star on GitHub helps too, and it costs nothing.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <a
            href={BUY_ME_A_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg overflow-hidden transition-opacity hover:opacity-90"
          >
            <img src="/buy-me-a-coffee.png" alt="Buy me a coffee" className="block h-9 w-auto" />
          </a>
          <LinkButton href={GITHUB_SPONSORS_URL} external variant="secondary" size="lg" hasIcon>
            <IconHeart aria-hidden="true" className="size-4" />
            Sponsor on GitHub
          </LinkButton>
          <LinkButton href={GITHUB_URL} external variant="ghost" size="lg" hasIcon>
            <IconStar aria-hidden="true" className="size-4" />
            Star on GitHub
          </LinkButton>
        </div>
      </HelpTopic>

      <HelpTopic title="Made by">
        <p className={PROSE}>
          <MakerLink maker={MAKERS.boidu} /> and <MakerLink maker={MAKERS.adalie} />, with thanks to{" "}
          <a href={CONTRIBUTORS_URL} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
            everyone who's sent a PR
          </a>{" "}
          and everyone in the{" "}
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
