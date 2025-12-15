import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "lucide-react";

const articles = [
  {
    id: "perche-imparare-coding-bambini",
    title: "Perché imparare a programmare da bambini?",
    excerpt: "Scopri i benefici cognitivi e pratici che il coding può offrire ai tuoi figli fin dalla tenera età.",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80",
    category: "Educazione",
    readTime: "5 min",
    date: "10 Dicembre 2024",
  },
  {
    id: "come-scegliere-percorso-figlio",
    title: "Come scegliere il percorso giusto per tuo figlio",
    excerpt: "Una guida pratica per orientarsi tra le diverse opzioni e trovare il corso più adatto.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80",
    category: "Guida",
    readTime: "7 min",
    date: "5 Dicembre 2024",
  },
  {
    id: "gestire-tempo-schermo-sano",
    title: "Come gestire il tempo di schermo in modo sano",
    excerpt: "Consigli pratici per trovare il giusto equilibrio tra tecnologia e altre attività.",
    image: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=600&q=80",
    category: "Genitori",
    readTime: "6 min",
    date: "28 Novembre 2024",
  },
  {
    id: "roblox-opportunita-bambini",
    title: "Roblox: da gioco a opportunità educativa",
    excerpt: "Come trasformare la passione per Roblox in competenze reali di programmazione.",
    image: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=600&q=80",
    category: "Gaming",
    readTime: "4 min",
    date: "20 Novembre 2024",
  },
  {
    id: "competenze-futuro-bambini",
    title: "Le competenze del futuro che ogni bambino dovrebbe avere",
    excerpt: "Pensiero computazionale, creatività e problem solving: le skill che faranno la differenza.",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80",
    category: "Futuro",
    readTime: "8 min",
    date: "15 Novembre 2024",
  },
  {
    id: "sicurezza-online-bambini",
    title: "Sicurezza online: guida per genitori",
    excerpt: "Tutto quello che devi sapere per proteggere i tuoi figli nel mondo digitale.",
    image: "https://images.unsplash.com/photo-1563206767-5b18f218e8de?auto=format&fit=crop&w=600&q=80",
    category: "Sicurezza",
    readTime: "10 min",
    date: "8 Novembre 2024",
  },
];

const categoryColors: Record<string, string> = {
  Educazione: "bg-tech-purple/10 text-tech-purple",
  Guida: "bg-tech-orange/10 text-tech-orange",
  Genitori: "bg-tech-cyan/10 text-tech-cyan",
  Gaming: "bg-tech-pink/10 text-tech-pink",
  Futuro: "bg-tech-green/10 text-tech-green",
  Sicurezza: "bg-tech-yellow/10 text-tech-yellow",
};

export default function Blog() {
  return (
    <Layout>
      {/* Hero */}
      <section className="tech-section bg-gradient-to-b from-tech-purple-light to-background">
        <div className="tech-container">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Blog & Risorse
            </h1>
            <p className="text-lg text-muted-foreground">
              Articoli, guide e consigli per genitori che vogliono accompagnare i figli nel mondo della tecnologia.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Article */}
      <section className="tech-section pt-8">
        <div className="tech-container">
          <Link to={`/blog/${articles[0].id}`} className="block">
            <div className="tech-card tech-card-hover overflow-hidden grid lg:grid-cols-2">
              <div className="aspect-video lg:aspect-auto">
                <img 
                  src={articles[0].image} 
                  alt={articles[0].title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={categoryColors[articles[0].category]}>
                    {articles[0].category}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {articles[0].readTime}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">{articles[0].title}</h2>
                <p className="text-muted-foreground mb-6">{articles[0].excerpt}</p>
                <span className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Leggi l'articolo
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="tech-section">
        <div className="tech-container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.slice(1).map((article) => (
              <Link 
                key={article.id}
                to={`/blog/${article.id}`} 
                className="tech-card tech-card-hover overflow-hidden group"
              >
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={article.image} 
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className={categoryColors[article.category]}>
                      {article.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{article.date}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {article.readTime}
                    </span>
                    <span className="text-primary font-medium flex items-center gap-1">
                      Leggi
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="tech-section bg-muted/30">
        <div className="tech-container">
          <div className="tech-card p-8 md:p-12 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Resta aggiornato
            </h2>
            <p className="text-muted-foreground mb-6">
              Iscriviti alla newsletter per ricevere articoli, guide e consigli direttamente nella tua inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="La tua email"
                className="flex-1 h-12 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Iscriviti
              </button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
}
