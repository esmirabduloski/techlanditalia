import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, BookOpen, Trophy, Target, MessageSquare, 
  Settings, ChevronRight, ChevronLeft, X, PartyPopper,
  Users, GraduationCap, FileText, Bell, ClipboardList,
  BarChart3, Calendar, Video, UserCheck, Star
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const studentSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Rocket className="w-12 h-12 text-primary" />,
    title: 'Benvenuto in TECHLAND! 🚀',
    description: 'Siamo entusiasti di averti qui! Questo breve tour ti mostrerà come navigare nella piattaforma e sfruttare al massimo il tuo percorso di apprendimento.',
  },
  {
    id: 'courses',
    icon: <BookOpen className="w-12 h-12 text-primary" />,
    title: 'I Tuoi Corsi',
    description: 'Nella dashboard troverai tutti i corsi a cui sei iscritto. Clicca su un corso per vedere le lezioni, i task e iniziare a programmare!',
  },
  {
    id: 'calendar',
    icon: <Calendar className="w-12 h-12 text-primary" />,
    title: 'Calendario Lezioni 📅',
    description: 'In cima alla dashboard trovi il calendario con tutte le tue prossime lezioni. Puoi nascondere quelle già completate con il toggle apposito.',
  },
  {
    id: 'lessons',
    icon: <GraduationCap className="w-12 h-12 text-primary" />,
    title: 'Lezioni e Task',
    description: 'Ogni lezione contiene presentazioni, editor di codice (Python, HTML/CSS/JS) e task da completare. Completa i task per guadagnare punti!',
  },
  {
    id: 'homework',
    icon: <FileText className="w-12 h-12 text-primary" />,
    title: 'Compiti e Consegne 📝',
    description: 'I tuoi insegnanti assegneranno compiti con scadenze per gruppo. Trovi tutto nella sezione "Compiti" della dashboard. Consegna in tempo per massimizzare i punti!',
  },
  {
    id: 'points',
    icon: <Trophy className="w-12 h-12 text-accent" />,
    title: 'Punti, Livelli e Badge 🏆',
    description: 'Completando lezioni, task e compiti guadagni punti che ti fanno salire di livello. Sblocca badge speciali raggiungendo traguardi importanti!',
  },
  {
    id: 'streaks',
    icon: <Target className="w-12 h-12 text-secondary" />,
    title: 'Mantieni le Streak 🔥',
    description: 'Partecipa alle lezioni e consegna i compiti regolarmente per costruire le tue streak! Streak più lunghe = bonus punti extra ai traguardi 7, 14, 21, 28 e 32!',
  },
  {
    id: 'leaderboard',
    icon: <Star className="w-12 h-12 text-accent" />,
    title: 'Classifica 🥇',
    description: 'Confronta i tuoi progressi con gli altri studenti nella classifica! Puoi filtrare per corso o gruppo per vedere chi è in testa.',
  },
  {
    id: 'bookmarks',
    icon: <BookOpen className="w-12 h-12 text-muted-foreground" />,
    title: 'Segnalibri 📌',
    description: 'Salva le lezioni e i task più importanti con i segnalibri per ritrovarli facilmente dalla dashboard.',
  },
  {
    id: 'profile',
    icon: <Settings className="w-12 h-12 text-muted-foreground" />,
    title: 'Personalizza il Profilo',
    description: 'Vai nel tuo Profilo per scegliere il tuo avatar. Il bordo dell\'avatar diventa più bello man mano che sali di livello!',
  },
  {
    id: 'complete',
    icon: <PartyPopper className="w-12 h-12 text-primary" />,
    title: 'Sei Pronto! 🎉',
    description: 'Ottimo! Ora sai tutto quello che ti serve per iniziare. Buon divertimento con la programmazione!',
  },
];

const parentSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Rocket className="w-12 h-12 text-primary" />,
    title: 'Benvenuto in TECHLAND! 🚀',
    description: 'Grazie per aver scelto TECHLAND per il percorso educativo di tuo figlio! Questo tour ti mostrerà come monitorare i suoi progressi.',
  },
  {
    id: 'children',
    icon: <Users className="w-12 h-12 text-primary" />,
    title: 'Profilo dei Figli',
    description: 'Nella dashboard puoi vedere i profili dei tuoi figli iscritti, i loro corsi, punti, badge e progressi complessivi.',
  },
  {
    id: 'calendar',
    icon: <Calendar className="w-12 h-12 text-primary" />,
    title: 'Calendario Lezioni 📅',
    description: 'Consulta il calendario delle prossime lezioni dei tuoi figli, con date, orari e titoli descrittivi per ogni appuntamento.',
  },
  {
    id: 'progress',
    icon: <GraduationCap className="w-12 h-12 text-secondary" />,
    title: 'Monitora i Progressi',
    description: 'Visualizza l\'avanzamento nei corsi con grafici dettagliati, i punti guadagnati e le streak di partecipazione e compiti.',
  },
  {
    id: 'homework',
    icon: <FileText className="w-12 h-12 text-primary" />,
    title: 'Compiti e Scadenze',
    description: 'Tieni traccia dei compiti assegnati ai tuoi figli e delle scadenze specifiche per il loro gruppo. Puoi vedere lo stato di ogni consegna.',
  },
  {
    id: 'attendance',
    icon: <UserCheck className="w-12 h-12 text-primary" />,
    title: 'Storico Presenze',
    description: 'Controlla lo storico delle presenze alle lezioni. Vedrai se tuo figlio era presente, assente o giustificato per ogni lezione.',
  },
  {
    id: 'feedback',
    icon: <MessageSquare className="w-12 h-12 text-accent" />,
    title: 'Feedback e Commenti',
    description: 'Ricevi comunicazioni e feedback diretti dagli insegnanti riguardo ai progressi e al comportamento in classe dei tuoi figli.',
  },
  {
    id: 'payments',
    icon: <Star className="w-12 h-12 text-muted-foreground" />,
    title: 'Saldo Lezioni e Acquisti',
    description: 'Nella sezione dedicata puoi controllare il saldo lezioni e accedere allo shop per acquistare pacchetti aggiuntivi.',
  },
  {
    id: 'complete',
    icon: <PartyPopper className="w-12 h-12 text-primary" />,
    title: 'Tutto Pronto! 🎉',
    description: 'Ora sai come navigare nella piattaforma. Grazie per essere parte della famiglia TECHLAND!',
  },
];

const teacherSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    icon: <Rocket className="w-12 h-12 text-primary" />,
    title: 'Benvenuto, Insegnante! 🚀',
    description: 'Grazie per far parte del team TECHLAND! Questo tour ti mostrerà tutti gli strumenti a tua disposizione per gestire i tuoi gruppi e studenti.',
  },
  {
    id: 'groups',
    icon: <Users className="w-12 h-12 text-primary" />,
    title: 'I Tuoi Gruppi',
    description: 'Nella dashboard trovi tutti i gruppi che ti sono stati assegnati, con il numero di studenti, il progresso e lo stato di ogni gruppo.',
  },
  {
    id: 'calendar',
    icon: <Calendar className="w-12 h-12 text-primary" />,
    title: 'Calendario Settimanale 📅',
    description: 'Il calendario settimanale ti mostra tutte le lezioni della settimana. Puoi navigare tra le settimane e vedere i dettagli di ogni lezione.',
  },
  {
    id: 'attendance',
    icon: <ClipboardList className="w-12 h-12 text-secondary" />,
    title: 'Registro Presenze',
    description: 'Per ogni lezione puoi segnare le presenze degli studenti (presente, assente, giustificato). Le streak vengono aggiornate automaticamente!',
  },
  {
    id: 'grading',
    icon: <BarChart3 className="w-12 h-12 text-accent" />,
    title: 'Valutazione Compiti',
    description: 'Nella sezione Gradebook puoi valutare i compiti degli studenti con un voto da 0 a 100 e lasciare feedback personalizzati.',
  },
  {
    id: 'courses',
    icon: <BookOpen className="w-12 h-12 text-primary" />,
    title: 'Corsi e Lezioni',
    description: 'Accedi ai corsi che ti sono stati assegnati per consultare lezioni, task e compiti. Puoi vedere tutto il materiale didattico disponibile.',
  },
  {
    id: 'reports',
    icon: <FileText className="w-12 h-12 text-primary" />,
    title: 'Report Lezioni',
    description: 'Dopo ogni lezione puoi compilare un report con gli argomenti trattati, quelli non coperti e gli studenti che necessitano supporto.',
  },
  {
    id: 'comments',
    icon: <MessageSquare className="w-12 h-12 text-muted-foreground" />,
    title: 'Commenti Studenti',
    description: 'Lascia commenti sui singoli studenti visibili ai genitori e/o agli studenti stessi. Utile per comunicare progressi o aree di miglioramento.',
  },
  {
    id: 'notifications',
    icon: <Bell className="w-12 h-12 text-muted-foreground" />,
    title: 'Notifiche e Link Utili',
    description: 'Ricevi notifiche quando ti vengono assegnati nuovi gruppi. Nella sezione Link Utili trovi risorse condivise dall\'admin.',
  },
  {
    id: 'meeting',
    icon: <Video className="w-12 h-12 text-primary" />,
    title: 'Link Meeting',
    description: 'Ogni gruppo ha un link meeting per gli studenti e uno per te. Li trovi nella pagina dettaglio del gruppo.',
  },
  {
    id: 'complete',
    icon: <PartyPopper className="w-12 h-12 text-primary" />,
    title: 'Sei Pronto! 🎉',
    description: 'Ottimo! Ora conosci tutti gli strumenti a tua disposizione. Buon lavoro!',
  },
];

interface OnboardingTourProps {
  userId: string;
  userRole: 'student' | 'parent' | 'teacher';
  onComplete: () => void;
}

export function OnboardingTour({ userId, userRole, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();
  
  const steps = userRole === 'parent' ? parentSteps : userRole === 'teacher' ? teacherSteps : studentSteps;
  const totalSteps = steps.length;
  const step = steps[currentStep];

  const profilePath = userRole === 'teacher' ? '/insegnante' : '/area-riservata/profilo';
  const profileLabel = userRole === 'teacher' ? 'dashboard insegnante' : 'sezione Profilo';

  const showCompletionToast = (skipped: boolean) => {
    toast({
      title: skipped ? 'Tutorial saltato' : 'Tutorial completato! 🎉',
      description: `Puoi rivederlo quando vuoi dal pulsante "Ripeti Tutorial" nella ${profileLabel}.`,
      duration: 7000,
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete(true);
  };

  const handleComplete = async (skipped: boolean) => {
    setIsVisible(false);
    
    // Mark onboarding as completed in the database
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId);
    
    showCompletionToast(skipped);
    onComplete();
  };

  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-lg"
          >
            <Card className="border-primary/20 shadow-2xl overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <CardHeader className="relative pb-2">
                <button
                  onClick={handleSkip}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
                  aria-label="Salta tour"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                
                <div className="flex justify-center mb-4 pt-4">
                  <motion.div
                    key={step.id}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10"
                  >
                    {step.icon}
                  </motion.div>
                </div>

                <CardTitle className="text-center text-xl md:text-2xl">
                  {step.title}
                </CardTitle>
                <CardDescription className="text-center text-base mt-2">
                  Step {currentStep + 1} di {totalSteps}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                <motion.p
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-muted-foreground mb-8 leading-relaxed"
                >
                  {step.description}
                </motion.p>

                {/* Step indicators */}
                <div className="flex justify-center gap-2 mb-6">
                  {steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentStep 
                          ? 'w-8 bg-primary' 
                          : index < currentStep 
                            ? 'bg-primary/50' 
                            : 'bg-muted-foreground/30'
                      }`}
                      aria-label={`Vai allo step ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-3">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="flex-1"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleNext}
                    className={`flex-1 ${currentStep === 0 ? 'w-full' : ''}`}
                  >
                    {currentStep === totalSteps - 1 ? (
                      <>
                        Inizia! 🚀
                      </>
                    ) : (
                      <>
                        Avanti
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Skip link */}
                {currentStep < totalSteps - 1 && (
                  <button
                    onClick={handleSkip}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors"
                  >
                    Salta il tour
                  </button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
