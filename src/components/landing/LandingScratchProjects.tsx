import { motion } from 'framer-motion';

const PROJECTS = [
  { id: '1304833814', title: 'Progetto Scratch #1' },
  { id: '1310221121', title: 'Progetto Scratch #2' },
  { id: '1308790999', title: 'Progetto Scratch #3' },
];

export function LandingScratchProjects() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Esempi di progetti completi
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Questi sono <strong>3 giochi reali</strong> che gli alunni impareranno a creare durante il corso di Scratch.
            Provali subito qui sotto!
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROJECTS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="aspect-[485/402] w-full overflow-hidden rounded-lg bg-muted">
                <iframe
                  src={`https://scratch.mit.edu/projects/${p.id}/embed`}
                  allowTransparency
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen
                  loading="lazy"
                  title={p.title}
                  className="w-full h-full"
                />
              </div>
              <div className="mt-3 text-center">
                <p className="font-semibold">{p.title}</p>
                <a
                  href={`https://scratch.mit.edu/projects/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Apri su Scratch ↗
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          ▶️ Clicca la bandiera verde per giocare. Premi il pulsante fullscreen per ingrandire.
        </p>
      </div>
    </section>
  );
}
