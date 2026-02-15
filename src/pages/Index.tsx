import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhyTechlandSection } from "@/components/sections/WhyTechlandSection";
import { CoursesPreviewSection } from "@/components/sections/CoursesPreviewSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ParentsSection } from "@/components/sections/ParentsSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { CTASection } from "@/components/sections/CTASection";
import { SEOHead, organizationSchema, websiteSchema } from "@/components/seo/SEOHead";

const Index = () => {
  return (
    <Layout>
      <SEOHead
        title="Corsi di Programmazione per Bambini e Ragazzi Online | TECHLAND"
        description="Corsi di coding e programmazione per bambini e ragazzi 6-18 anni. Scratch, Roblox, Minecraft, Python, Unity. Lezioni online in piccoli gruppi. Prima lezione gratis!"
        canonical="/"
        structuredData={[organizationSchema, websiteSchema]}
      />
      <HeroSection />
      <WhyTechlandSection />
      <CoursesPreviewSection />
      <HowItWorksSection />
      <ParentsSection />
      {/* <TestimonialsSection /> */}
      <FAQSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
