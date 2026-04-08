import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { MessageCircle, AlertTriangle, Users, CheckCircle2, Shield } from 'lucide-react';

interface LandingUrgencyProps {
  spots: number;
  whatsappUrl: string;
  ctaText: string;
}

export function LandingUrgency({ spots, whatsappUrl, ctaText }: LandingUrgencyProps) {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-primary/5 via-secondary/5 to-tech-teal/5">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-3xl border-2 border-secondary/30 bg-card p-8 sm:p-14 text-center overflow-hidden"
        >
          {/* Glow effect */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-secondary/10 rounded-full filter blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-primary/10 rounded-full filter blur-3xl" />

          <div className="relative z-10">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-flex items-center gap-2 bg-destructive/10 text-destructive rounded-full px-5 py-2 mb-6"
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-sm">I posti si stanno esaurendo!</span>
            </motion.div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground mb-4">
              Solo <span className="text-secondary">{spots}</span> posti rimasti
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-xl mx-auto">
              I nostri gruppi sono piccoli per garantire qualità. Non perdere l'occasione di dare a tuo figlio una competenza per il futuro.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              {[
                { icon: Users, text: 'Gruppi da 4–5 bambini' },
                { icon: CheckCircle2, text: 'Nessun vincolo' },
                { icon: Shield, text: 'Soddisfatti o rimborsati' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-2xl hover:shadow-secondary/30 hover:-translate-y-1 transition-all group text-base sm:text-lg px-8 sm:px-10 w-full max-w-sm"
              asChild
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                {ctaText}
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
