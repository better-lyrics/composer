import { DesignNav } from "@/pages/design/design-nav";
import { FoundationsSections } from "@/pages/design/foundations/foundations-sections";
import { PrimitivesSections } from "@/pages/design/primitives/primitives-sections";
import { StateMachineSections } from "@/pages/design/states/state-machine-sections";
import { LandingLayout } from "@/pages/landing/landing-layout";
import { PageHead } from "@/seo/page-head";
import { breadcrumbListSchema, organizationSchema } from "@/seo/schemas";
import { OverlayHosts } from "@/ui/overlay-hosts";
import { LazyMotion, domAnimation } from "motion/react";

// -- Constants -----------------------------------------------------------------

const PATH = "/design";
const TITLE = "Design system ・ Composer";
const DESCRIPTION =
  "The colors, surfaces, type and controls behind Composer, rendered live in whichever theme you pick.";

// -- Components ----------------------------------------------------------------

const DesignPage: React.FC = () => (
  <LazyMotion features={domAnimation} strict>
    <LandingLayout>
      <PageHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          breadcrumbListSchema([
            { name: "Composer", path: "/" },
            { name: "Design system", path: PATH },
          ]),
          organizationSchema(),
        ]}
      />
      <div className="px-6 py-14 max-w-6xl mx-auto">
        <header className="mb-12 max-w-2xl select-none">
          <h1 className="text-3xl md:text-5xl font-semibold text-composer-text mb-5 leading-tight text-balance">
            Design system
          </h1>
          <p className="text-lg text-composer-text-secondary leading-relaxed text-pretty">{DESCRIPTION}</p>
        </header>
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          <DesignNav />
          <div className="flex flex-col gap-20 mt-8 lg:mt-0">
            <FoundationsSections />
            <PrimitivesSections />
            <StateMachineSections />
          </div>
        </div>
      </div>
      <OverlayHosts />
    </LandingLayout>
  </LazyMotion>
);

// -- Exports -------------------------------------------------------------------

export default DesignPage;
