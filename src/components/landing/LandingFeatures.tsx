import { motion } from 'framer-motion';

interface Feature {
  emoji: string;
  title: string;
  description: string;
}

interface LandingFeaturesProps {
  features: Feature[];
  courseName?: string;
  courseLogo?: string;
  courseTagline?: string;
}

export function LandingFeatures({ features, courseName, courseLogo, courseTagline }: LandingFeaturesProps) {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          {/* Scratch context */}
          {(courseLogo || courseTagline) && (
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-6">
              {courseLogo && <img src={courseLogo} alt={courseName || ''} className="w-5 h-5" />}
              <span className="text-sm font-medium text-primary">{courseTagline || `Corso di ${courseName}`}</span>
            </div>
          )}
          <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground mb-4">
            Perché scegliere <span className="text-primary">TECHLAND</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Un metodo di insegnamento unico che trasforma la tecnologia in avventura
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative p-8 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="text-5xl mb-5">{feature.emoji}</div>
              <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
