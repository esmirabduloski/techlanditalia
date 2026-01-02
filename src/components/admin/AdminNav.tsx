import { Link, useLocation } from 'react-router-dom';
import { 
  FileText, GraduationCap, BookOpen, Mail, User, BarChart3, 
  Award, Eye, Calendar, ClipboardCheck, Users, Newspaper, UsersRound, CalendarClock
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Blog', icon: FileText },
  { to: '/admin/corsi', label: 'Corsi', icon: GraduationCap },
  { to: '/admin/gruppi', label: 'Gruppi', icon: UsersRound },
  { to: '/admin/calendario', label: 'Calendario', icon: Calendar },
  { to: '/admin/presenze', label: 'Presenze', icon: ClipboardCheck },
  { to: '/admin/prenotazioni', label: 'Prenotazioni', icon: BookOpen },
  { to: '/admin/contatti', label: 'Contatti', icon: Mail },
  { to: '/admin/newsletter', label: 'Newsletter', icon: Newspaper },
  { to: '/admin/utenti', label: 'Utenti', icon: Users },
  { to: '/admin/disponibilita', label: 'Disponibilità', icon: CalendarClock },
  { to: '/admin/valutazioni', label: 'Valutazioni', icon: Award },
  { to: '/admin/statistiche', label: 'Statistiche', icon: BarChart3 },
  { to: '/admin/simulatore', label: 'Simulatore', icon: Eye },
];

export function AdminNav() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-4 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`py-3 px-2 flex items-center gap-2 whitespace-nowrap ${
                  active
                    ? 'border-b-2 border-primary text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
