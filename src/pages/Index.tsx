import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhyTechlandSection } from "@/components/sections/WhyTechlandSection";
import { CoursesPreviewSection } from "@/components/sections/CoursesPreviewSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ParentsSection } from "@/components/sections/ParentsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { CTASection } from "@/components/sections/CTASection";
import { SEOKeywordsSection } from "@/components/sections/SEOKeywordsSection";
import { SEOHead } from "@/components/seo/SEOHead";

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="TECHLAND | Coding per Bambini e Ragazzi Online 6-18 anni"
        description="Coding per bambini e ragazzi 6-18 anni: corsi online live in piccoli gruppi con Scratch, Roblox, Minecraft e Python. Prima lezione gratis!"
        canonical="/"
      />
      <HeroSection />
      <WhyTechlandSection />
      <CoursesPreviewSection />
      <SEOKeywordsSection />
      <HowItWorksSection />
      <ParentsSection />
      <FAQSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
