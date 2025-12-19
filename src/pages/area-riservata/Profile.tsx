import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AvatarSelector, AvatarDisplay } from '@/components/gamification/AvatarSelector';
import { LevelBadge, PointsDisplay, getLevelFromPoints, LEVELS } from '@/components/gamification/LevelBadge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save, Trophy } from 'lucide-react';

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: dataLoading, updateAvatar } = useStudentProgress();
  const [selectedAvatar, setSelectedAvatar] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setSelectedAvatar(profile.avatar_id);
    }
  }, [profile]);

  if (authLoading || dataLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const level = getLevelFromPoints(profile.total_points);
  const hasChanges = selectedAvatar !== profile.avatar_id;

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateAvatar(selectedAvatar);
    setIsSaving(false);

    if (success) {
      toast({
        title: 'Profilo aggiornato!',
        description: 'Il tuo avatar è stato cambiato con successo.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Non è stato possibile aggiornare il profilo.',
      });
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/20 to-tech-cyan-light/20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/area-riservata">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Il Tuo Profilo
              </h1>
              <p className="text-muted-foreground">
                Personalizza il tuo avatar e visualizza i tuoi progressi
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Avatar & Level Card */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Avatar e Livello
                </CardTitle>
                <CardDescription>
                  Scegli il tuo avatar! Il bordo diventa più bello con i livelli.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Avatar Preview */}
                <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-xl">
                  <AvatarDisplay 
                    avatarId={selectedAvatar} 
                    level={level.level} 
                    size="xl"
                    showLevel
                  />
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{profile.full_name}</p>
                    <LevelBadge points={profile.total_points} size="sm" />
                  </div>
                </div>

                {/* Avatar Selector */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Scegli Avatar</p>
                  <AvatarSelector
                    selectedId={selectedAvatar}
                    onSelect={setSelectedAvatar}
                    level={level.level}
                  />
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSave} 
                  disabled={!hasChanges || isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salva Avatar
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Stats & Levels Card */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiche</CardTitle>
                <CardDescription>I tuoi progressi e punti accumulati</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Points */}
                <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Punti Totali</p>
                  <PointsDisplay points={profile.total_points} size="lg" />
                </div>

                {/* Current Level Progress */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Progressi Livello</p>
                  <LevelBadge points={profile.total_points} size="lg" showProgress />
                </div>

                {/* All Levels */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Tutti i Livelli</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {LEVELS.map((lvl) => {
                      const isUnlocked = profile.total_points >= lvl.min_points;
                      const isCurrent = lvl.level === level.level;
                      
                      return (
                        <div 
                          key={lvl.level}
                          className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                            isCurrent 
                              ? 'bg-primary/10 border border-primary/30' 
                              : isUnlocked 
                                ? 'bg-muted/50' 
                                : 'bg-muted/20 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{lvl.badge_emoji}</span>
                            <div>
                              <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                                Lv.{lvl.level} - {lvl.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lvl.min_points.toLocaleString()} punti
                              </p>
                            </div>
                          </div>
                          {isUnlocked && (
                            <span className="text-primary text-sm">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
