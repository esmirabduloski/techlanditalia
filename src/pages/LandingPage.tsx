import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { SEOHead } from '@/components/seo/SEOHead';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingUrgency } from '@/components/landing/LandingUrgency';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingCourseInfo } from '@/components/landing/LandingCourseInfo';
import { LandingFooter } from '@/components/landing/LandingFooter';


export default function LandingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading } = useQuery({
    queryKey: ['landing-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('slug', slug!)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-lg">Pagina non trovata</p>
      </div>
    );
  }

  const whatsappUrl = `https://wa.me/message/KHFBHZDEY3S7H1`;
  const features = (page.features as any[]) || [];
  const testimonials = (page.testimonials as any[]) || [];
  
  // Extract course-specific display info from page metadata
  const metadata = (page as any).metadata || {};
  const courseName = metadata.course_name || page.title;
  const courseEmoji = metadata.course_emoji;
  const courseLogo = metadata.course_logo;
  const courseTagline = metadata.course_tagline;
  const courseInfo = metadata.course_info;

  // Strategy B: when an /lp/ duplicates a /corsi/ topic, point canonical to the course page to avoid cannibalization.
  const lpToCourseCanonical: Record<string, string> = {
    'roblox': '/corsi/roblox',
    'python': '/corsi/python-base',
    'python-ai': '/corsi/python-ai',
  };
  const canonicalPath = lpToCourseCanonical[slug!] || `/lp/${slug}`;
  const canonicalUrl = `https://techlanditalia.it${canonicalPath}`;
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: page.title,
    description: page.meta_description || page.hero_subtitle || '',
    url: canonicalUrl,
    provider: {
      '@type': 'Organization',
      name: 'TECHLAND',
      sameAs: 'https://techlanditalia.it',
    },
    ...(courseInfo?.age && { educationalLevel: courseInfo.age }),
    ...(courseInfo?.topics && { teaches: courseInfo.topics }),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      inLanguage: 'it',
    },
  };
  const faqSchema = Array.isArray(metadata.faq) && metadata.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: metadata.faq.map((f: any) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null;

  return (
    <>
      <SEOHead
        title={page.meta_title || page.title}
        description={page.meta_description || ''}
        canonical={canonicalUrl}
        noIndex={true}
        structuredData={faqSchema ? [courseSchema, faqSchema] : courseSchema}
      />

      <div className="min-h-screen bg-background overflow-hidden">
        <LandingHero
          title={page.hero_title || page.title}
          subtitle={page.hero_subtitle || ''}
          ctaText={page.cta_text || 'Prenota ora'}
          spotsRemaining={page.spots_remaining || 0}
          whatsappUrl={whatsappUrl}
          courseName={courseName}
          courseEmoji={courseEmoji}
          courseLogo={courseLogo}
          courseTagline={courseTagline}
        />
        <LandingFeatures features={features} courseName={courseName} courseLogo={courseLogo} courseTagline={courseTagline} />
        {courseInfo && (
          <LandingCourseInfo courseInfo={courseInfo} courseName={courseName} courseEmoji={courseEmoji} />
        )}
        <LandingUrgency spots={page.spots_remaining || 0} whatsappUrl={whatsappUrl} ctaText={page.cta_text || 'Prenota ora'} />
        <LandingTestimonials testimonials={testimonials} />
        <LandingCTA
          ctaText={page.cta_text || 'Prenota ora'}
          whatsappUrl={whatsappUrl}
          spots={page.spots_remaining || 0}
        />
        <LandingFooter />
      </div>
    </>
  );
}
