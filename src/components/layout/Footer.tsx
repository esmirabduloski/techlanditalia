import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Mail } from "lucide-react";

const footerLinks = {
  corsi: [
    { label: "L'ABC dell'informatica", href: "/corsi/abc-informatica", title: "Corso ABC informatica per bambini 6-8 anni" },
    { label: "Programmazione Scratch", href: "/corsi/scratch", title: "Corso Scratch per bambini - programmazione visiva" },
    { label: "Corso Roblox Bambini", href: "/corsi/roblox", title: "Corso Roblox per bambini - sviluppo giochi" },
    { label: "Roblox Avanzato", href: "/corsi/roblox-avanzato", title: "Corso Roblox avanzato per ragazzi" },
    { label: "Web Development", href: "/corsi/web-development", title: "Corso sviluppo web per ragazzi" },
    { label: "Sviluppo Giochi Unity", href: "/corsi/unity", title: "Corso Unity sviluppo videogiochi" },
    { label: "Python Base", href: "/corsi/python-base", title: "Corso Python base per ragazzi" },
    { label: "Python PRO & AI", href: "/corsi/python-ai", title: "Corso Python avanzato e intelligenza artificiale" },
  ],
  azienda: [
    { label: "Chi Siamo", href: "/chi-siamo", title: "Scopri la scuola di coding TECHLAND" },
    { label: "Blog Coding Bambini", href: "/blog", title: "Articoli e guide sulla programmazione per bambini" },
    { label: "Lavora con noi", href: "/lavora-con-noi", title: "Lavora come insegnante di coding" },
    { label: "Contattaci", href: "/contatti", title: "Contatta TECHLAND per informazioni" },
  ],
  supporto: [
    { label: "FAQ Corsi Coding", href: "/faq", title: "Domande frequenti sui corsi di programmazione" },
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

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export function Footer() {
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
                  aria-label={`Seguici su ${social.label}`}
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
              {footerLinks.corsi.map((link) => (
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

          {/* Azienda */}
          <nav aria-label="Informazioni azienda">
            <h3 className="font-semibold text-lg mb-4">TECHLAND</h3>
            <ul className="space-y-3">
              {footerLinks.azienda.map((link) => (
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
                href="https://wa.me/393512508851" 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Contattaci su WhatsApp"
                className="flex items-center gap-2 text-background/70 hover:text-background text-sm"
              >
                <WhatsAppIcon />
                +39 351 250 8851 (WhatsApp)
              </a>
            </div>
          </nav>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-background/50 text-sm text-center md:text-left space-y-1">
            <p>© {new Date().getFullYear()} TECHLAND. Tutti i diritti riservati.</p>
            <p>P.IVA: 05596490267 — Sede legale: Vedelago (TV)</p>
          </div>
          <p className="text-background/50 text-sm">
            Made with ❤️ in Italia
          </p>
        </div>
      </div>
    </footer>
  );
}
