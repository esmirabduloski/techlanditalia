import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Globe, GraduationCap, Users, Shield, Search,
  ExternalLink, BookOpen, Gamepad2, Code, ClipboardCheck,
  MessageSquare, CreditCard, BarChart3, Calendar, Mail,
  FileText, Award, Database, Link as LinkIcon, Eye, Key, AlertTriangle
} from 'lucide-react';


interface Feature {
  name: string;
  description: string;
  route?: string;
}

interface FeatureSection {
  title: string;
  icon: React.ElementType;
  color: string;
  features: Feature[];
}

const sections: FeatureSection[] = [
  {
    title: 'Area Pubblica',
    icon: Globe,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    features: [
      { name: 'Homepage', description: 'Landing page con hero, sezioni informative, testimonianze e CTA per prenotazione prova gratuita.', route: '/' },
      { name: 'Catalogo Corsi', description: 'Elenco corsi filtrabile per livello ed età, con card informative ed emoji identificativi.', route: '/corsi' },
      { name: 'Dettaglio Corso', description: 'Pagina dedicata con descrizione, programma lezioni, livello e durata del corso.', route: '/corsi/:id' },
      { name: 'Blog', description: 'Articoli SEO-optimized per genitori su coding, educazione digitale e tecnologia per bambini.', route: '/blog' },
      { name: 'Chi Siamo', description: 'Presentazione del team, missione e valori di Techland.', route: '/chi-siamo' },
      { name: 'Prenotazione Prova', description: 'Form di prenotazione lezione di prova gratuita con campi per età, interesse e disponibilità.', route: '/prenota' },
      { name: 'Contatti', description: 'Form di contatto con email e WhatsApp, notifiche admin per nuovi messaggi.', route: '/contatti' },
      { name: 'FAQ', description: 'Domande frequenti con accordion espandibili.', route: '/faq' },
      { name: 'Lavora Con Noi', description: 'Pagina candidature con form per posizione, CV e messaggio.', route: '/lavora-con-noi' },
      { name: 'Privacy Policy', description: 'Informativa sulla privacy conforme GDPR.', route: '/privacy' },
      { name: 'Termini e Condizioni', description: 'Termini di servizio della piattaforma.', route: '/termini' },
      { name: 'Cookie Policy', description: 'Informativa sull\'uso dei cookie.', route: '/cookie' },
    ],
  },
  {
    title: 'Area Studenti',
    icon: GraduationCap,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
    features: [
      { name: 'Dashboard Studente', description: 'Panoramica con corsi iscritti, progressi, punti, badge, streak e compiti in scadenza.', route: '/area-riservata' },
      { name: 'Profilo', description: 'Gestione dati personali, selezione avatar e visualizzazione livello gamification.', route: '/area-riservata/profilo' },
      { name: 'Progresso Corso', description: 'Vista dettagliata delle lezioni completate, task e compiti per ogni corso.', route: '/area-riservata/corso/:courseId' },
      { name: 'Vista Lezione', description: 'Contenuto lezione con slides Google embedded, video e materiale didattico.', route: '/area-riservata/corso/:courseId/lezione/:n' },
      { name: 'Editor Codice Python', description: 'Compilatore Python integrato con supporto Turtle graphics e PyGame Zero.', route: '/area-riservata/.../task/:n' },
      { name: 'Editor Codice Web', description: 'Editor HTML/CSS/JS con anteprima live e salvataggio bozze automatico.', route: '/area-riservata/.../task/:n' },
      { name: 'Compiti', description: 'Visualizzazione compiti assegnati, upload file, editor codice e invio consegne.', route: '/area-riservata/compito/:id' },
      { name: 'Gamification — Punti', description: 'Sistema di punti guadagnati completando lezioni, task e compiti. Livelli progressivi.' },
      { name: 'Gamification — Badge', description: 'Collezione di badge sbloccabili in base a traguardi (lezioni, compiti, streak).' },
      { name: 'Gamification — Streak', description: 'Contatore di presenze e compiti consecutivi con bonus punti ai milestone.' },
      { name: 'Classifica', description: 'Leaderboard con ranking studenti per punti totali, avatar e livello.', route: '/area-riservata/classifica' },
      { name: 'Acquisti', description: 'Sezione prodotti acquistabili tramite Stripe con filtri per categoria.', route: '/area-riservata/acquisti' },
      { name: 'Segnalibri', description: 'Possibilità di salvare lezioni e task come preferiti per accesso rapido.' },
      { name: 'Notifiche Scadenze', description: 'Avvisi per compiti in scadenza con countdown e promemoria.' },
    ],
  },
  {
    title: 'Area Genitori',
    icon: Users,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    features: [
      { name: 'Dashboard Genitore', description: 'Panoramica con sezione figli, progressi, feedback insegnanti e storico pagamenti.', route: '/area-riservata' },
      { name: 'Monitoraggio Figli', description: 'Vista presenze, compiti consegnati, voti e calendario lezioni per ogni figlio.' },
      { name: 'Badge Figli', description: 'Visualizzazione badge e traguardi raggiunti dai figli.' },
      { name: 'Storico Pagamenti', description: 'Elenco pagamenti effettuati tramite Stripe con dettagli importo e data.' },
      { name: 'Chat Supporto', description: 'Chat integrata con AI per domande sulla piattaforma e supporto tecnico.' },
      { name: 'Feedback Insegnanti', description: 'Sezione con commenti e valutazioni degli insegnanti sui figli.' },
      { name: 'Commenti Studente', description: 'Note e osservazioni visibili al genitore sul percorso del figlio.' },
    ],
  },
  {
    title: 'Area Insegnanti',
    icon: BookOpen,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    features: [
      { name: 'Dashboard Insegnante', description: 'Panoramica gruppi assegnati, calendario settimanale e notifiche.', route: '/insegnante' },
      { name: 'Dettaglio Gruppo', description: 'Lista studenti del gruppo, presenze, commenti e link riunione.', route: '/insegnante/gruppo/:id' },
      { name: 'Dettaglio Studente', description: 'Profilo studente con progressi, presenze, compiti e commenti.', route: '/insegnante/studente/:id' },
      { name: 'Vista Corso', description: 'Accesso al materiale didattico dei corsi assegnati.', route: '/insegnante/corso/:slug' },
      { name: 'Vista Lezione', description: 'Contenuto completo della lezione con slides, task e compiti.', route: '/insegnante/corso/:slug/lezione/:n' },
      { name: 'Vista Task', description: 'Dettaglio task con editor codice e contenuto.', route: '/insegnante/corso/:slug/lezione/:n/task/:t' },
      { name: 'Valutazione Compiti', description: 'Interfaccia per valutare compiti consegnati con voto e feedback testuale.', route: '/insegnante/valutazioni' },
      { name: 'Registro Voti', description: 'Gradebook con griglia studenti/compiti e medie per gruppo.', route: '/insegnante/registro-voti' },
      { name: 'Report Lezioni', description: 'Form per compilare report post-lezione con argomenti trattati e studenti da supportare.' },
      { name: 'Calendario Settimanale', description: 'Visualizzazione calendario con lezioni programmate per la settimana.' },
    ],
  },
  {
    title: 'Area Admin',
    icon: Shield,
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    features: [
      { name: 'Gestione Blog', description: 'Editor rich-text per creare e modificare articoli del blog con immagini e SEO.', route: '/admin' },
      { name: 'Gestione Corsi', description: 'CRUD completo corsi con titolo, descrizione, livello, età e visibilità.', route: '/admin/corsi' },
      { name: 'Gestione Lezioni', description: 'Creazione e modifica lezioni con contenuto, slides, video e numerazione.', route: '/admin/corsi/:id/lezioni' },
      { name: 'Gestione Task', description: 'Task per lezione con editor codice preimpostato, allegati e punti.', route: '/admin/corsi/:id/lezioni/:id/task' },
      { name: 'Gestione Compiti', description: 'Compiti assegnabili con scadenza, editor codice e sistema allegati.', route: '/admin/corsi/:id/lezioni/:id/compiti' },
      { name: 'Gestione Gruppi', description: 'Creazione gruppi studenti con corso, insegnante, orari, link meeting e WhatsApp.', route: '/admin/gruppi' },
      { name: 'Calendario Lezioni', description: 'Pianificazione lezioni programmate con calendario e gestione presenze.', route: '/admin/lezioni-programmate' },
      { name: 'Presenze', description: 'Registro presenze per lezione programmata con stati (presente/assente/giustificato).', route: '/admin/presenze' },
      { name: 'Prenotazioni', description: 'Gestione prenotazioni prove gratuite con notifiche per nuove richieste.', route: '/admin/prenotazioni' },
      { name: 'Contatti', description: 'Visualizzazione messaggi dal form contatti con notifiche.', route: '/admin/contatti' },
      { name: 'Newsletter', description: 'Gestione iscritti newsletter con invio email e conferma double opt-in.', route: '/admin/newsletter' },
      { name: 'Utenti', description: 'Gestione profili utenti, creazione account, reset password e toggle ruoli.', route: '/admin/utenti' },
      { name: 'Disponibilità Insegnanti', description: 'Calendario disponibilità insegnanti con gestione turni.', route: '/admin/disponibilita' },
      { name: 'Valutazioni', description: 'Panoramica valutazioni compiti con filtri per corso e gruppo.', route: '/admin/valutazioni' },
      { name: 'Statistiche', description: 'Dashboard con metriche su iscrizioni, completamento corsi e performance.', route: '/admin/statistiche' },
      { name: 'Link Insegnanti', description: 'Gestione link utili condivisi con gli insegnanti.', route: '/admin/link-insegnanti' },
      { name: 'Report Lezioni', description: 'Visualizzazione report post-lezione compilati dagli insegnanti.', route: '/admin/report-lezioni' },
      { name: 'Backup', description: 'Snapshot automatici e manuali del contenuto (corsi, lezioni, task) con ripristino.', route: '/admin/backup' },
      { name: 'Simulatore Vista', description: 'Impersonazione utenti per vedere la piattaforma dalla loro prospettiva.' },
      { name: 'Documentazione', description: 'Questa pagina — catalogo completo delle funzionalità della piattaforma.', route: '/admin/documentazione' },
    ],
  },
];

export default function AdminDocumentation() {
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        features: section.features.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            (f.route && f.route.toLowerCase().includes(q))
        ),
      }))
      .filter((s) => s.features.length > 0);
  }, [search]);

  const totalFeatures = sections.reduce((acc, s) => acc + s.features.length, 0);

  return (
    <Layout>
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Documentazione Funzionalità</h1>
          <p className="text-muted-foreground">
            Catalogo completo di tutte le {totalFeatures} funzionalità della piattaforma, organizzate per area.
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca funzionalità..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nessuna funzionalità trovata per "{search}"
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={sections.map((s) => s.title)} className="space-y-4">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return (
                <AccordionItem key={section.title} value={section.title} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${section.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-lg font-semibold">{section.title}</span>
                      <Badge variant="secondary" className="ml-2">
                        {section.features.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 pt-2">
                      {section.features.map((feature) => (
                        <Card key={feature.name} className="border-muted">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium">{feature.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                              </div>
                              {feature.route && (
                                <Badge variant="outline" className="shrink-0 font-mono text-xs">
                                  {feature.route}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Sezione rotazione chiavi API */}
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Rotazione chiavi API</h2>
              <p className="text-sm text-muted-foreground">Buona pratica: ruota ogni 90 giorni.</p>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                Le chiavi API non vanno mai condivise via chat/email. In caso di sospetto leak, ruotale subito dai relativi dashboard e aggiorna il valore nei Secrets di Lovable Cloud.
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 mt-4">
            {[
              { name: 'STRIPE_SECRET_KEY', where: 'Stripe Dashboard → Developers → API keys → Roll secret key', why: 'Pagamenti e checkout.' },
              { name: 'RESEND_API_KEY', where: 'Resend Dashboard → API Keys → Revoke + Create new', why: 'Invio email transazionali e newsletter.' },
              { name: 'JIRA_API_TOKEN', where: 'Atlassian → Account settings → Security → API tokens', why: 'Creazione bug ticket dal frontend.' },
              { name: 'QUOTE_GENIE_API_KEY', where: 'Progetto Quote Genie → impostazioni API', why: 'Integrazione clienti Quote Genie.' },
              { name: 'LOVABLE_API_KEY', where: 'Bottone "Rotate" nei Secrets di Lovable Cloud', why: 'Accesso AI Gateway. Ruotala se sospetti uso non autorizzato.' },
            ].map((k) => (
              <Card key={k.name}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <Badge variant="outline" className="font-mono text-xs w-fit">{k.name}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{k.why}</div>
                      <div className="text-xs text-muted-foreground mt-1">📍 {k.where}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            ✅ Promemoria: segna in calendario un check trimestrale (es. 1° giorno del trimestre) per rivedere e ruotare le chiavi.
          </p>
        </div>
      </div>
    </Layout>
  );
}
