import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertTriangle, Bell, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHomeworkDeadlineNotifications } from '@/hooks/useHomeworkDeadlineNotifications';

export function DeadlineNotifications() {
  const { upcomingDeadlines, dismissNotification } = useHomeworkDeadlineNotifications();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Show notifications one at a time
  const currentDeadline = upcomingDeadlines[currentIndex];

  // Auto-advance after dismissing or when current is no longer valid
  useEffect(() => {
    if (currentIndex >= upcomingDeadlines.length && upcomingDeadlines.length > 0) {
      setCurrentIndex(0);
    }
  }, [upcomingDeadlines, currentIndex]);

  if (upcomingDeadlines.length === 0) return null;

  const getUrgencyStyle = (hoursRemaining: number) => {
    if (hoursRemaining <= 24) {
      return {
        bgClass: 'from-red-500/95 to-red-600/95',
        borderClass: 'border-red-400/50',
        icon: AlertTriangle,
        label: 'Urgente!',
      };
    }
    if (hoursRemaining <= 48) {
      return {
        bgClass: 'from-orange-500/95 to-orange-600/95',
        borderClass: 'border-orange-400/50',
        icon: Clock,
        label: 'Scade presto',
      };
    }
    return {
      bgClass: 'from-amber-500/95 to-amber-600/95',
      borderClass: 'border-amber-400/50',
      icon: Bell,
      label: 'Promemoria',
    };
  };

  const formatTimeRemaining = (hoursRemaining: number) => {
    if (hoursRemaining < 1) {
      const minutes = Math.round(hoursRemaining * 60);
      return `${minutes} minuti`;
    }
    if (hoursRemaining < 24) {
      const hours = Math.round(hoursRemaining);
      return `${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    }
    const days = Math.floor(hoursRemaining / 24);
    const remainingHours = Math.round(hoursRemaining % 24);
    if (days === 1) {
      return remainingHours > 0 ? `1 giorno e ${remainingHours}h` : '1 giorno';
    }
    return `${days} giorni`;
  };

  const handleDismiss = () => {
    if (currentDeadline) {
      dismissNotification(currentDeadline.id);
      // Move to next notification
      if (currentIndex < upcomingDeadlines.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCurrentIndex(0);
      }
    }
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % upcomingDeadlines.length);
  };

  if (!currentDeadline) return null;

  const urgency = getUrgencyStyle(currentDeadline.hoursRemaining);
  const UrgencyIcon = urgency.icon;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className={`rounded-full w-14 h-14 p-0 shadow-lg bg-gradient-to-r ${urgency.bgClass} hover:opacity-90`}
        >
          <div className="relative">
            <Bell className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-500 rounded-full text-xs font-bold flex items-center justify-center">
              {upcomingDeadlines.length}
            </span>
          </div>
        </Button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentDeadline.id}
        initial={{ x: 100, opacity: 0, scale: 0.9 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ x: -100, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed bottom-4 right-4 z-50 max-w-sm w-full mx-4 rounded-xl shadow-2xl border ${urgency.borderClass} overflow-hidden`}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${urgency.bgClass} text-white px-4 py-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UrgencyIcon className="w-5 h-5" />
              <span className="font-semibold text-sm">{urgency.label}</span>
              {upcomingDeadlines.length > 1 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {currentIndex + 1}/{upcomingDeadlines.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setIsMinimized(true)}
              >
                <span className="text-lg">−</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-card p-4">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">{currentDeadline.courseEmoji}</span>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">
                {currentDeadline.title}
              </h4>
              <p className="text-sm text-muted-foreground truncate">
                {currentDeadline.courseTitle}
              </p>
            </div>
          </div>

          {/* Time remaining */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Tempo rimanente:</span>
            <span className={`font-bold ${
              currentDeadline.hoursRemaining <= 24 ? 'text-destructive' : 
              currentDeadline.hoursRemaining <= 48 ? 'text-orange-500' : 'text-amber-500'
            }`}>
              {formatTimeRemaining(currentDeadline.hoursRemaining)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button asChild className="flex-1" size="sm">
              <Link to={`/area-riservata/compito/${currentDeadline.id}`}>
                Vai al compito
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            {upcomingDeadlines.length > 1 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleNext}
              >
                Prossimo
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
