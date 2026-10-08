import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Esito dei link nelle email della newsletter.
 *
 * Le edge function non possono mostrare pagine HTML (Supabase le serve come
 * testo semplice), quindi rimandano qui:
 * - /newsletter?esito=...                         conferma dell'iscrizione
 * - /newsletter?azione=disiscrizione&token=...    disiscrizione, solo dopo il clic
 *   sul pulsante: i filtri antispam che aprono i link in anticipo non
 *   disiscrivono nessuno.
 */

const ESITI: Record<string, { emoji: string; title: string; text: string }> = {
  confermata: {
    emoji: "🎉",
    title: "Iscrizione confermata!",
    text: "Riceverai i nuovi articoli e le novità di TECHLAND.",
  },
  "gia-confermata": {
    emoji: "👍",
    title: "Eri già iscritto",
    text: "La tua iscrizione era già stata confermata.",
  },
  disiscritto: {
    emoji: "👋",
    title: "Ci mancherai!",
    text: "Ti sei disiscritto dalla newsletter. Se cambi idea puoi reiscriverti dalla pagina del blog.",
  },
  "link-non-valido": {
    emoji: "❌",
    title: "Link non valido",
    text: "Il link non è valido o è già stato usato.",
  },
  errore: {
    emoji: "❌",
    title: "Qualcosa è andato storto",
    text: "Riprova più tardi o scrivici dalla pagina Contatti.",
  },
};

type Stato = "da-confermare" | "invio" | keyof typeof ESITI;

export default function Newsletter() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const vuoleDisiscriversi = params.get("azione") === "disiscrizione";
  const [stato, setStato] = useState<Stato>(() => {
    if (vuoleDisiscriversi) return token ? "da-confermare" : "link-non-valido";
    const esito = params.get("esito") ?? "";
    return esito in ESITI ? esito : "link-non-valido";
  });

  const disiscrivi = async () => {
    setStato("invio");
    const { data, error } = await supabase.functions.invoke("newsletter-unsubscribe", { body: { token } });
    if (data?.success) setStato("disiscritto");
    else if (error && "context" in error && (error.context as Response).status === 404) setStato("link-non-valido");
    else setStato("errore");
  };

  const esito = ESITI[stato];

  return (
    <Layout>
      <SEOHead
        title="Newsletter | TECHLAND"
        description="Gestisci la tua iscrizione alla newsletter di TECHLAND."
        noIndex
      />
      <section className="tech-section">
        <div className="tech-container">
          <div className="max-w-md mx-auto text-center">
            {stato === "da-confermare" || stato === "invio" ? (
              <>
                <div className="text-6xl mb-4">✉️</div>
                <h1 className="text-3xl font-bold mb-4">Vuoi disiscriverti?</h1>
                <p className="text-muted-foreground mb-8">
                  Non riceverai più la newsletter di TECHLAND.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" onClick={disiscrivi} disabled={stato === "invio"}>
                    {stato === "invio" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Sì, disiscrivimi
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/blog">No, resto iscritto</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">{esito.emoji}</div>
                <h1 className="text-3xl font-bold mb-4">{esito.title}</h1>
                <p className="text-muted-foreground mb-8">{esito.text}</p>
                <Button asChild size="lg">
                  <Link to="/blog">Vai al blog</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
