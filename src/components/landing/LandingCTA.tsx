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
      
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            Regala a tuo figlio il <span className="text-secondary">superpotere</span> del futuro
          </h2>
          <p className="text-white/80 text-lg mb-4 max-w-xl mx-auto">
            La prima lezione è completamente gratuita. Scrivi su WhatsApp e ti organizziamo tutto noi.
          </p>
          <p className="text-white/60 text-sm mb-10">
            Solo {spots} posti disponibili • Rispondiamo in meno di 1 ora
          </p>

          <Button
            size="xl"
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-2xl hover:shadow-secondary/40 hover:-translate-y-1 transition-all group text-xl px-12 py-6 h-auto"
            asChild
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-7 h-7 mr-3 group-hover:animate-bounce" />
              {ctaText}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
