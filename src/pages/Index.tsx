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
        title="Corsi di Coding per Bambini Online 6-18 | TECHLAND"
        description="Corsi di coding online per bambini e ragazzi: Scratch, Roblox, Minecraft, Python. Lezioni live in piccoli gruppi. Prima lezione gratis!"
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
