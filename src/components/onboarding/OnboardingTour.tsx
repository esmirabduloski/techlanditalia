import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  Rocket, BookOpen, Trophy, Target, MessageSquare, 
  Settings, ChevronRight, ChevronLeft, X, PartyPopper,
  Users, GraduationCap, FileText, Bell
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
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
    description: 'Nella dashboard troverai tutti i corsi a cui sei iscritto. Clicca su un corso per vedere le lezioni e iniziare a imparare!',
    highlight: 'I Tuoi Corsi',
  },
  {
    id: 'points',
    icon: <Trophy className="w-12 h-12 text-accent" />,
    title: 'Guadagna Punti e Badge',
    description: 'Completando lezioni e compiti guadagni punti che ti fanno salire di livello! Sblocca badge speciali raggiungendo traguardi importanti.',
    highlight: 'Punti Totali',
  },
  {
    id: 'streaks',
    icon: <Target className="w-12 h-12 text-secondary" />,
    title: 'Mantieni le Streak 🔥',
    description: 'Partecipa alle lezioni e consegna i compiti regolarmente per costruire le tue streak! Streak più lunghe = bonus punti extra!',
    highlight: 'Le Tue Streak',
  },
  {
    id: 'homework',
    icon: <FileText className="w-12 h-12 text-primary" />,
    title: 'Compiti e Esercizi',
    description: 'I tuoi insegnanti assegneranno compiti che troverai nella sezione dedicata. Consegna in tempo per massimizzare i punti!',
    highlight: 'Compiti in scadenza',
  },
  {
    id: 'profile',
    icon: <Settings className="w-12 h-12 text-muted-foreground" />,
    title: 'Personalizza il Profilo',
    description: 'Vai nelle impostazioni per scegliere il tuo avatar e personalizzare il tuo profilo. Rendilo unico!',
    highlight: 'Profilo',
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
    description: 'Nella sezione dedicata puoi vedere tutti i profili dei tuoi figli iscritti, i loro progressi e i badge ottenuti.',
    highlight: 'I Tuoi Figli',
  },
  {
    id: 'progress',
    icon: <GraduationCap className="w-12 h-12 text-secondary" />,
    title: 'Monitora i Progressi',
    description: 'Visualizza l\'avanzamento nei corsi, i punti guadagnati e le streak di partecipazione e compiti.',
  },
  {
    id: 'feedback',
    icon: <MessageSquare className="w-12 h-12 text-accent" />,
    title: 'Feedback degli Insegnanti',
    description: 'Ricevi comunicazioni e feedback diretti dagli insegnanti riguardo ai progressi e al comportamento in classe.',
    highlight: 'Feedback',
  },
  {
    id: 'homework',
    icon: <FileText className="w-12 h-12 text-primary" />,
    title: 'Compiti Assegnati',
    description: 'Tieni traccia dei compiti assegnati ai tuoi figli e delle relative scadenze per aiutarli a rimanere organizzati.',
  },
  {
    id: 'notifications',
    icon: <Bell className="w-12 h-12 text-muted-foreground" />,
    title: 'Resta Aggiornato',
    description: 'Riceverai notifiche importanti via email riguardo a nuovi compiti, feedback e comunicazioni dalla scuola.',
  },
  {
    id: 'complete',
    icon: <PartyPopper className="w-12 h-12 text-primary" />,
    title: 'Tutto Pronto! 🎉',
    description: 'Ora sai come navigare nella piattaforma. Grazie per essere parte della famiglia TECHLAND!',
  },
];

interface OnboardingTourProps {
  userId: string;
  userRole: 'student' | 'parent';
  onComplete: () => void;
}

export function OnboardingTour({ userId, userRole, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  const steps = userRole === 'parent' ? parentSteps : studentSteps;
  const totalSteps = steps.length;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsVisible(false);
    
    // Mark onboarding as completed in the database
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId);
    
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
