import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowRight } from 'lucide-react';

interface LandingCTAProps {
  ctaText: string;
  whatsappUrl: string;
  spots: number;
}

export function LandingCTA({ ctaText, whatsappUrl, spots }: LandingCTAProps) {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-tech-teal" />
      
      <div className="relative z-10 max-w-3xl mx-auto text-center px-2">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            Regala a tuo figlio il <span className="text-white font-extrabold underline decoration-secondary decoration-4 underline-offset-4">superpotere</span> del futuro
          </h2>
          <p className="text-white/80 text-base sm:text-lg mb-4 max-w-xl mx-auto">
            La prima lezione è completamente gratuita. Scrivi su WhatsApp e ti organizziamo tutto noi.
          </p>
          <p className="text-white/60 text-sm mb-10">
            Solo {spots} posti disponibili • Rispondiamo in meno di 1 ora
          </p>

          <Button
            size="lg"
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-2xl hover:shadow-secondary/40 hover:-translate-y-1 transition-all group text-base sm:text-xl px-8 sm:px-12 w-full max-w-sm"
            asChild
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-6 h-6 mr-2 group-hover:animate-bounce" />
              {ctaText}
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
