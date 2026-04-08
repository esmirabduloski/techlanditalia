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

  return (
    <>
      <SEOHead
        title={page.meta_title || page.title}
        description={page.meta_description || ''}
      />
      <div className="min-h-screen bg-background overflow-hidden">
        <LandingHero
          title={page.hero_title || page.title}
          subtitle={page.hero_subtitle || ''}
          ctaText={page.cta_text || 'Prenota ora'}
          spotsRemaining={page.spots_remaining || 0}
          whatsappUrl={whatsappUrl}
        />
        <LandingFeatures features={features} />
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
