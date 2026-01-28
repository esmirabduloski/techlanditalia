import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, User, Users, GraduationCap, BookOpen } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !impersonatedUser) return null;

  const roleIcon = {
    student: <GraduationCap className="w-4 h-4" />,
    parent: <Users className="w-4 h-4" />,
    teacher: <BookOpen className="w-4 h-4" />
  };

  const roleLabel = {
    student: 'Studente',
    parent: 'Genitore',
    teacher: 'Insegnante'
  };

  const handleExit = () => {
    stopImpersonation();
    navigate('/admin/simulatore');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Modalità Impersonazione</span>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              {roleIcon[impersonatedUser.role]}
              <span className="font-medium">{impersonatedUser.fullName}</span>
              <span className="text-amber-800">({roleLabel[impersonatedUser.role]})</span>
            </div>
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleExit}
          className="bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
        >
          <X className="w-4 h-4 mr-2" />
          Esci
        </Button>
      </div>
    </div>
  );
}
