import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Maria Rossi",
    role: "Mamma di Luca, 10 anni",
    content: "Luca era sempre attaccato ai videogiochi. Ora li crea lui! La passione per la tecnologia è diventata produttiva grazie a TECHLAND.",
    rating: 5,
    avatar: "MR",
  },
  {
    name: "Giuseppe Bianchi",
    role: "Papà di Sofia, 14 anni",
    content: "Sofia ha sviluppato il suo primo sito web in 3 mesi. I docenti sono preparatissimi e il supporto ai genitori è eccezionale.",
    rating: 5,
    avatar: "GB",
  },
  {
    name: "Anna Verdi",
    role: "Mamma di Marco, 7 anni",
    content: "Perfetto per i più piccoli! Marco si diverte tantissimo con Scratch e sta imparando la logica senza nemmeno rendersene conto.",
    rating: 5,
    avatar: "AV",
  },
  {
    name: "Roberto Neri",
    role: "Papà di Emma, 16 anni",
    content: "Emma vuole studiare informatica all'università. TECHLAND le ha dato le basi solide di Python e AI che cercava.",
    rating: 5,
    avatar: "RN",
  },
];

export function TestimonialsSection() {
  return (
    <section className="tech-section bg-foreground text-background overflow-hidden dark:border-t dark:border-border/40">
      <div className="tech-container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-background">
            Cosa dicono i genitori
          </h2>
          <p className="text-lg text-background/70 max-w-2xl mx-auto">
            Oltre 15.000 famiglie ci hanno già scelto. Ecco le loro storie.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="p-6 rounded-2xl bg-background/5 backdrop-blur-sm border border-background/10 hover:bg-background/10 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-secondary mb-4 opacity-50" />
              <p className="text-background/90 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-background">{testimonial.name}</p>
                  <p className="text-sm text-background/60">{testimonial.role}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
