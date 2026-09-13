import { useState, useEffect } from "react";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicCourseSlug } from "@/lib/courseCatalog";
import { useSiteSetting } from "@/hooks/useSiteSetting";

const buildAziendaLinks = (lavoraVisible: boolean) => [
  { label: "Chi Siamo", href: "/chi-siamo", title: "Scopri la scuola di coding TECHLAND" },
  { label: "Blog Coding Bambini", href: "/blog", title: "Articoli e guide sulla programmazione per bambini" },
  ...(lavoraVisible ? [{ label: "Lavora con noi", href: "/lavora-con-noi", title: "Lavora come insegnante di coding" }] : []),
  { label: "Contattaci", href: "/contatti", title: "Contatta TECHLAND per informazioni" },
];

const footerLinks = {
  supporto: [
    { label: "FAQ Corsi Coding", href: "/faq", title: "Domande frequenti sui corsi di programmazione" },
    { label: "Glossario Coding & AI", href: "/glossario", title: "Glossario dei termini di programmazione spiegati semplicemente" },
    { label: "Prenota Lezione Gratuita", href: "/prenota", title: "Prenota una lezione di prova gratuita" },
    { label: "Privacy Policy", href: "/privacy", title: "Informativa sulla privacy" },
    { label: "Termini di Servizio", href: "/termini", title: "Termini e condizioni" },
    { label: "Cookie Policy", href: "/cookie", title: "Informativa sui cookie" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "https://www.facebook.com/profile.php?id=61573749912297", label: "Facebook" },
  { icon: Instagram, href: "https://www.instagram.com/techlanditalia/", label: "Instagram" },
  { icon: Linkedin, href: "https://www.linkedin.com/in/techlanditalia/", label: "LinkedIn" },
];


export function Footer() {
  const [courses, setCourses] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('slug, title')
        .eq('is_visible', true)
        .order('title');
      if (data) setCourses(data);
    };
    fetchCourses();
  }, []);

  const { value: lavoraVisible } = useSiteSetting<boolean>('lavora_con_noi_visible', true);
  const aziendaLinks = buildAziendaLinks(lavoraVisible);

  return (
    <footer className="bg-foreground text-background" role="contentinfo">
      <div className="tech-container py-16 px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6" title="TECHLAND - Corsi di programmazione per bambini">
              <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold text-background">
                TECHLAND
              </span>
            </Link>
            <p className="text-background/70 mb-6 max-w-sm">
              La scuola leader in Italia per i <strong>corsi di programmazione per bambini</strong> e ragazzi dai 6 ai 18 anni. Corsi di coding, Roblox, Minecraft, Python e sviluppo web.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
                  aria-label={`Seguici su ${social.label} (si apre in una nuova finestra)`}
                  title={`TECHLAND su ${social.label}`}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Corsi */}
          <nav aria-label="Corsi di programmazione">
            <h3 className="font-semibold text-lg mb-4">Corsi Coding Bambini</h3>
            <ul className="space-y-3">
              {courses.map((course) => (
                <li key={course.slug}>
                  <Link
                    to={`/corsi/${publicCourseSlug(course.slug)}`}
                    title={`Corso ${course.title}`}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {course.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Azienda */}
          <nav aria-label="Informazioni azienda">
            <h3 className="font-semibold text-lg mb-4">TECHLAND</h3>
            <ul className="space-y-3">
              {aziendaLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    title={link.title}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Supporto */}
          <nav aria-label="Supporto e informazioni">
            <h3 className="font-semibold text-lg mb-4">Supporto</h3>
            <ul className="space-y-3">
              {footerLinks.supporto.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    title={link.title}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <a 
                href="mailto:info@techlanditalia.it" 
                title="Invia email a TECHLAND"
                className="flex items-center gap-2 text-background/70 hover:text-background text-sm"
              >
                <Mail className="w-4 h-4" />
                info@techlanditalia.it
              </a>
              <a 
                href="https://wa.me/message/KHFBHZDEY3S7H1" 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Contattaci su WhatsApp"
                className="flex items-center gap-2 text-background/70 hover:text-background text-sm"
              >
                <WhatsAppIcon />
                +39 350 581 3140 (WhatsApp)
                {/* Il nome accessibile deve contenere il testo visibile: niente aria-label
                    che lo sostituisce, l'avviso "nuova finestra" va in testo solo per screen reader */}
                <span className="sr-only"> - si apre in una nuova finestra</span>
              </a>
            </div>
          </nav>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-background/50 text-sm text-center md:text-left space-y-1">
            <p>© {new Date().getFullYear()} TECHLAND. Tutti i diritti riservati.</p>
            <p>P.IVA: 05596490267 — REA: 459874 — Sede legale: Vedelago (TV)</p>
          </div>
          <div className="flex items-center gap-4 text-background/50 text-sm">
            <Link to="/accessibilita" className="hover:text-background transition-colors underline">
              Accessibilità
            </Link>
            <span>Made with ❤️ in Italia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
