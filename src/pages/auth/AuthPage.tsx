import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Rocket, Users, KeyRound, GraduationCap, ShieldCheck } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function AuthPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Registration fields (admin only)
  const [regRole, setRegRole] = useState<'parent' | 'teacher'>('parent');
  const [childName, setChildName] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childCourse, setChildCourse] = useState('');
  const [courses, setCourses] = useState<{ id: string; title: string; emoji: string }[]>([]);
  
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Fetch courses for registration
  useEffect(() => {
    if (isAdmin) {
      const fetchCourses = async () => {
        const { data } = await supabase.from('courses').select('id, title, emoji');
        if (data) setCourses(data);
      };
      fetchCourses();
    }
  }, [isAdmin]);

  // Redirect authenticated non-admin users
  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      if (!authLoading && user && !showNewPasswordForm) {
        if (isAdmin) return;
        
        const { data: teacherRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'teacher')
          .maybeSingle();
        
        if (teacherRole) {
          navigate('/insegnante');
        } else {
          navigate('/area-riservata');
        }
      }
    };
    
    checkRoleAndRedirect();
  }, [user, isAdmin, authLoading, showNewPasswordForm, navigate]);

  // Check if user came from password reset link
  useEffect(() => {
    const checkRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const hashType = hashParams.get('type');
      const queryType = searchParams.get('type');
      
      if ((hashType === 'recovery' && accessToken) || queryType === 'recovery') {
        setShowNewPasswordForm(true);
        window.history.replaceState(null, '', '/auth?reset=true');
      }
    };
    
    checkRecoverySession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowNewPasswordForm(true);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Le password non coincidono', description: 'Assicurati che le due password siano identiche' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Password troppo corta', description: 'La password deve avere almeno 6 caratteri' });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ variant: 'destructive', title: 'Errore', description: error.message });
      } else {
        toast({ title: 'Password aggiornata!', description: 'La tua password è stata aggiornata con successo' });
        setShowNewPasswordForm(false);
        setPassword('');
        setConfirmPassword('');
        navigate('/area-riservata');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Errore', description: 'Si è verificato un errore. Riprova più tardi.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({ variant: 'destructive', title: 'Email richiesta', description: 'Inserisci la tua email per reimpostare la password' });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: resetEmail.trim().toLowerCase(), redirectUrl: `${window.location.origin}/auth?reset=true` }
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile inviare l\'email. Riprova più tardi.' });
      } else {
        toast({ title: 'Email inviata!', description: 'Controlla la tua casella email per reimpostare la password' });
        setShowResetPassword(false);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Errore', description: 'Si è verificato un errore. Riprova più tardi.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Unified login: use the edge function which handles both email and username
      const { data: loginData, error: loginError } = await supabase.functions.invoke('student-login', {
        body: { identifier: identifier.trim(), password }
      });

      if (loginError || loginData?.error) {
        toast({
          variant: 'destructive',
          title: 'Errore di accesso',
          description: loginData?.error || 'Credenziali non corrette',
        });
      } else if (loginData?.session) {
        await supabase.auth.setSession(loginData.session);
        toast({ title: 'Benvenuto!', description: 'Accesso effettuato con successo' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Errore', description: 'Si è verificato un errore durante l\'accesso' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast({ variant: 'destructive', title: 'Non autorizzato', description: 'Solo gli admin possono registrare nuovi utenti' });
      return;
    }

    if (regRole === 'parent' && (!childName.trim() || !childUsername.trim())) {
      toast({ variant: 'destructive', title: 'Dati figlio obbligatori', description: 'Inserisci nome e username del figlio' });
      return;
    }

    if (regPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password troppo corta', description: 'La password deve avere almeno 6 caratteri' });
      return;
    }

    setIsLoading(true);

    try {
      const body: Record<string, string | undefined> = {
        role: regRole,
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        fullName: fullName.trim(),
      };

      if (regRole === 'parent') {
        body.childName = childName.trim();
        body.childUsername = childUsername.trim();
        body.courseId = childCourse || undefined;
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', { body });

      if (error || data?.error) {
        toast({ variant: 'destructive', title: 'Errore di registrazione', description: data?.error || 'Impossibile creare l\'account' });
      } else {
        toast({ title: 'Account creato!', description: `Account ${regRole === 'parent' ? 'genitore + figlio' : 'insegnante'} creato con successo` });
        setRegEmail('');
        setRegPassword('');
        setFullName('');
        setChildName('');
        setChildUsername('');
        setChildCourse('');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Errore', description: 'Si è verificato un errore durante la registrazione' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/30 to-tech-cyan-light/30 dark:from-background dark:via-background dark:to-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              {showNewPasswordForm ? (
                <KeyRound className="w-8 h-8 text-primary" />
              ) : (
                <Rocket className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {showNewPasswordForm ? 'Nuova Password' : 'Accedi'}
            </h1>
            <p className="text-muted-foreground">
              {showNewPasswordForm 
                ? 'Inserisci la tua nuova password' 
                : 'Accedi per vedere i tuoi corsi e progressi'}
            </p>
          </div>

          {/* New Password Form */}
          {showNewPasswordForm ? (
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Crea nuova password</CardTitle>
                <CardDescription>Scegli una password sicura di almeno 6 caratteri</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nuova Password</Label>
                    <PasswordInput id="new-password" placeholder="Minimo 6 caratteri" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Conferma Password</Label>
                    <PasswordInput id="confirm-password" placeholder="Ripeti la password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aggiornamento...</> : 'Aggiorna Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : showResetPassword ? (
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Reimposta Password</CardTitle>
                <CardDescription>Inserisci la tua email e ti invieremo un link per reimpostare la password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" placeholder="mario@esempio.it" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required disabled={isLoading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Invio in corso...</> : 'Invia link di reset'}
                  </Button>
                  <button type="button" onClick={() => setShowResetPassword(false)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                    ← Torna al login
                  </button>
                </form>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-border/50 shadow-lg">
            {isAdmin ? (
              <Tabs defaultValue="signup" className="w-full">
                <CardHeader className="pb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Accedi</TabsTrigger>
                    <TabsTrigger value="signup">
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Registra Utente
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="login" className="mt-0">
                    {renderLoginForm()}
                  </TabsContent>
                  <TabsContent value="signup" className="mt-0">
                    {renderAdminSignupForm()}
                  </TabsContent>
                </CardContent>
              </Tabs>
            ) : (
              <>
                <CardHeader className="pb-4">
                  <CardTitle className="text-center">Accedi</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderLoginForm()}
                </CardContent>
              </>
            )}
          </Card>
          )}

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Accedendo accetti i nostri{' '}
            <a href="/termini" className="text-primary hover:underline">Termini e Condizioni</a>{' '}
            e la{' '}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </Layout>
  );

  function renderLoginForm() {
    return (
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-identifier">Email o Nome Utente</Label>
          <Input
            id="login-identifier"
            type="text"
            placeholder="mario@esempio.it oppure luca123"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Genitori e insegnanti: inserisci la tua email · Studenti: inserisci il tuo username
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <PasswordInput
            id="login-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Accesso in corso...</> : 'Accedi'}
        </Button>
        <button
          type="button"
          onClick={() => setShowResetPassword(true)}
          className="w-full text-center text-sm text-primary hover:underline mt-2"
        >
          Password dimenticata?
        </button>
      </form>
    );
  }

  function renderAdminSignupForm() {
    return (
      <form onSubmit={handleAdminSignup} className="space-y-4">
        {/* Role selection */}
        <div className="space-y-2">
          <Label>Tipo di utente</Label>
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setRegRole('parent')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                regRole === 'parent' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Genitore
            </button>
            <button
              type="button"
              onClick={() => setRegRole('teacher')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                regRole === 'teacher' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Insegnante
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="space-y-3 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            {regRole === 'parent' ? <Users className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
            Dati {regRole === 'parent' ? 'Genitore' : 'Insegnante'}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="signup-name">Nome Completo</Label>
            <Input id="signup-name" type="text" placeholder="Mario Rossi" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" placeholder="mario@esempio.it" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <PasswordInput id="signup-password" placeholder="Minimo 6 caratteri" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required disabled={isLoading} minLength={6} />
          </div>
        </div>

        {/* Child Info - only for parent */}
        {regRole === 'parent' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-medium text-tech-teal">
              <GraduationCap className="w-4 h-4" />
              Dati del figlio/a (obbligatori)
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-name">Nome del figlio/a</Label>
              <Input id="child-name" type="text" placeholder="Luca" value={childName} onChange={(e) => setChildName(e.target.value)} required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-username">Nome utente per il login</Label>
              <Input id="child-username" type="text" placeholder="luca123" value={childUsername} onChange={(e) => setChildUsername(e.target.value)} required disabled={isLoading} />
              <p className="text-xs text-muted-foreground">Il figlio userà questo nome utente per accedere</p>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">Il figlio userà la stessa password del genitore per accedere</p>
            <div className="space-y-2">
              <Label htmlFor="child-course">Corso acquistato</Label>
              <Select value={childCourse} onValueChange={setChildCourse}>
                <SelectTrigger id="child-course">
                  <SelectValue placeholder="Seleziona un corso (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non ho ancora deciso</SelectItem>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.emoji} {course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creazione in corso...</> : `Crea account ${regRole === 'parent' ? 'Genitore + Figlio' : 'Insegnante'}`}
        </Button>
      </form>
    );
  }
}
