import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/sections/HeroSection";
import { WhyTechlandSection } from "@/components/sections/WhyTechlandSection";
import { CoursesPreviewSection } from "@/components/sections/CoursesPreviewSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ParentsSection } from "@/components/sections/ParentsSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { CTASection } from "@/components/sections/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <WhyTechlandSection />
      <CoursesPreviewSection />
      <HowItWorksSection />
      <ParentsSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
