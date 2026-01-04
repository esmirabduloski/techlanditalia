import { Link, useLocation } from 'react-router-dom';
import { 
  FileText, GraduationCap, BookOpen, Mail, User, BarChart3, 
  Award, Eye, Calendar, ClipboardCheck, Users, Newspaper, UsersRound, CalendarClock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useEffect } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  notificationKey?: 'newBookings' | 'newContacts';
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Blog', icon: FileText },
  { to: '/admin/corsi', label: 'Corsi', icon: GraduationCap },
  { to: '/admin/gruppi', label: 'Gruppi', icon: UsersRound },
  { to: '/admin/lezioni-programmate', label: 'Calendario', icon: Calendar },
  { to: '/admin/presenze', label: 'Presenze', icon: ClipboardCheck },
  { to: '/admin/prenotazioni', label: 'Prenotazioni', icon: BookOpen, notificationKey: 'newBookings' },
  { to: '/admin/contatti', label: 'Contatti', icon: Mail, notificationKey: 'newContacts' },
  { to: '/admin/newsletter', label: 'Newsletter', icon: Newspaper },
  { to: '/admin/utenti', label: 'Utenti', icon: Users },
  { to: '/admin/disponibilita', label: 'Disponibilità', icon: CalendarClock },
  { to: '/admin/valutazioni', label: 'Valutazioni', icon: Award },
  { to: '/admin/statistiche', label: 'Statistiche', icon: BarChart3 },
  { to: '/admin/simulatore', label: 'Simulatore', icon: Eye },
];

export function AdminNav() {
  const location = useLocation();
  const { notifications, markBookingsAsSeen, markContactsAsSeen } = useAdminNotifications();
  
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  // Mark notifications as seen when visiting the respective pages
  useEffect(() => {
    if (location.pathname === '/admin/prenotazioni') {
      markBookingsAsSeen();
    }
    if (location.pathname === '/admin/contatti') {
      markContactsAsSeen();
    }
  }, [location.pathname]);

  const getNotificationCount = (key?: 'newBookings' | 'newContacts') => {
    if (!key) return 0;
    return notifications[key];
  };

  return (
    <div className="border-b bg-background sticky top-[73px] z-40">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide pb-px" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            const notificationCount = getNotificationCount(item.notificationKey);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`py-3 px-2 flex items-center gap-2 whitespace-nowrap relative ${
                  active
                    ? 'border-b-2 border-primary text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {notificationCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse"
                  >
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
