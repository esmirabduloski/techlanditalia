import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, Linkedin, Mail, Phone, MapPin } from "lucide-react";

const footerLinks = {
  corsi: [
    { label: "Coding Base", href: "/corsi/coding-base" },
    { label: "Game Development", href: "/corsi/game-development" },
    { label: "Roblox Studio", href: "/corsi/roblox-studio" },
    { label: "Web Development", href: "/corsi/web-development" },
    { label: "Python & AI", href: "/corsi/python-ai" },
  ],
  azienda: [
    { label: "Chi siamo", href: "/chi-siamo" },
    { label: "Blog", href: "/blog" },
    { label: "Lavora con noi", href: "/lavora-con-noi" },
    { label: "Contatti", href: "/contatti" },
  ],
  supporto: [
    { label: "FAQ", href: "/#faq" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Termini di Servizio", href: "/termini" },
    { label: "Cookie Policy", href: "/cookie" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="tech-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">T</span>
              </div>
              <span className="text-2xl font-bold text-background">
                TECHLAND
              </span>
            </Link>
            <p className="text-background/70 mb-6 max-w-sm">
              La piattaforma leader in Italia per l'insegnamento del coding a bambini e ragazzi dai 6 ai 18 anni. Trasformiamo la passione per la tecnologia in competenze per il futuro.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Corsi */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Corsi</h4>
            <ul className="space-y-3">
              {footerLinks.corsi.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Azienda */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Azienda</h4>
            <ul className="space-y-3">
              {footerLinks.azienda.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Supporto */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Supporto</h4>
            <ul className="space-y-3">
              {footerLinks.supporto.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <a href="mailto:info@techland.it" className="flex items-center gap-2 text-background/70 hover:text-background text-sm">
                <Mail className="w-4 h-4" />
                info@techland.it
              </a>
              <a href="tel:+390123456789" className="flex items-center gap-2 text-background/70 hover:text-background text-sm">
                <Phone className="w-4 h-4" />
                +39 012 345 6789
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/50 text-sm">
            © {new Date().getFullYear()} TECHLAND. Tutti i diritti riservati.
          </p>
          <p className="text-background/50 text-sm">
            Made with ❤️ in Italia
          </p>
        </div>
      </div>
    </footer>
  );
}
