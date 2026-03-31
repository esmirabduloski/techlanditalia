import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/corsi': 'Corsi',
  '/chi-siamo': 'Chi Siamo',
  '/faq': 'Domande Frequenti',
  '/blog': 'Blog',
  '/contatti': 'Contatti',
  '/prenota': 'Prenota Lezione Gratuita',
  '/privacy': 'Privacy Policy',
  '/termini': 'Termini di Servizio',
  '/cookie': 'Cookie Policy',
  '/lavora-con-noi': 'Lavora con noi',
  '/auth': 'Accesso',
  '/area-riservata': 'Dashboard Studente',
  '/area-riservata/profilo': 'Profilo',
  '/area-riservata/acquisti': 'Acquisti',
  '/area-riservata/classifica': 'Classifica',
  '/insegnante': 'Dashboard Insegnante',
  '/admin': 'Pannello Admin',
  '/admin/login': 'Login Admin',
};

export function RouteAnnouncer() {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const title = routeTitles[location.pathname] || document.title || 'Pagina caricata';
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      setAnnouncement(`Navigato a: ${title}`);
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
