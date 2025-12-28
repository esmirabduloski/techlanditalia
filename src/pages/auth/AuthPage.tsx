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
import { Loader2, Rocket, Users, KeyRound, GraduationCap } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function AuthPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Child registration fields
  const [childName, setChildName] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childCourse, setChildCourse] = useState('');
  const [courses, setCourses] = useState<{ id: string; title: string; emoji: string }[]>([]);
  
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  
  // Login mode: 'parent' (email) or 'student' (username)
  const [loginMode, setLoginMode] = useState<'parent' | 'student'>('parent');
  const [loginUsername, setLoginUsername] = useState('');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Fetch courses for registration
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase.from('courses').select('id, title, emoji');
      if (data) setCourses(data);
    };
    fetchCourses();
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (!authLoading && user && !showNewPasswordForm) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/area-riservata');
      }
    }
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
      toast({
        variant: 'destructive',
        title: 'Le password non coincidono',
        description: 'Assicurati che le due password siano identiche',
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password troppo corta',
        description: 'La password deve avere almeno 6 caratteri',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: error.message,
        });
      } else {
        toast({
          title: 'Password aggiornata!',
          description: 'La tua password è stata aggiornata con successo',
        });
        setShowNewPasswordForm(false);
        setPassword('');
        setConfirmPassword('');
        navigate('/area-riservata');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Si è verificato un errore. Riprova più tardi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email richiesta',
        description: 'Inserisci la tua email per reimpostare la password',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { 
          email: email.trim().toLowerCase(),
          redirectUrl: `${window.location.origin}/auth?reset=true`
        }
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile inviare l\'email. Riprova più tardi.',
        });
      } else {
        toast({
          title: 'Email inviata!',
          description: 'Controlla la tua casella email per reimpostare la password',
        });
        setShowResetPassword(false);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Si è verificato un errore. Riprova più tardi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginMode === 'student') {
        // Student login via edge function (bypasses RLS)
        const { data: loginData, error: loginError } = await supabase.functions.invoke('student-login', {
          body: { username: loginUsername.trim(), password }
        });

        if (loginError || loginData?.error) {
          toast({
            variant: 'destructive',
            title: 'Errore di accesso',
            description: loginData?.error || 'Impossibile effettuare il login',
          });
        } else if (loginData?.session) {
          // Set the session
          await supabase.auth.setSession(loginData.session);
          toast({
            title: 'Benvenuto!',
            description: 'Accesso effettuato con successo',
          });
        }
      } else {
        // Parent login with email
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast({
            variant: 'destructive',
            title: 'Errore di accesso',
            description: error.message === 'Invalid login credentials' 
              ? 'Email o password non corretti' 
              : error.message,
          });
        } else {
          toast({
            title: 'Benvenuto!',
            description: 'Accesso effettuato con successo',
          });
        }
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Si è verificato un errore durante l\'accesso',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate child data
    if (!childName.trim() || !childUsername.trim()) {
      toast({
        variant: 'destructive',
        title: 'Dati figlio obbligatori',
        description: 'Inserisci tutti i dati del figlio: nome e username',
      });
      return;
    }

    // Check username uniqueness
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', childUsername.trim())
      .maybeSingle();

    if (existingUser) {
      toast({
        variant: 'destructive',
        title: 'Username già in uso',
        description: 'Questo username è già utilizzato. Scegline un altro per tuo figlio.',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Register parent
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/area-riservata`,
          data: {
            full_name: fullName,
            role: 'parent',
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            variant: 'destructive',
            title: 'Utente già registrato',
            description: 'Questa email è già associata a un account. Prova ad accedere.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Errore di registrazione',
            description: error.message,
          });
        }
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Create child profile via edge function (needs service role)
        // Child uses same password as parent
        const { error: childError } = await supabase.functions.invoke('create-child-account', {
          body: {
            parentId: authData.user.id,
            childName: childName.trim(),
            childUsername: childUsername.trim(),
            childPassword: password, // Use parent's password
            courseId: childCourse || null,
          }
        });

        if (childError) {
          console.error('Error creating child account:', childError);
        }

        // Send welcome email (no password, child uses parent's password)
        supabase.functions.invoke('send-welcome-email', {
          body: { 
            email, 
            fullName, 
            role: 'parent',
            childName: childName.trim(),
            childUsername: childUsername.trim(),
          }
        }).catch(err => console.error('Welcome email error:', err));

        toast({
          title: 'Registrazione completata!',
          description: 'Benvenuto nella famiglia TECHLAND! Controlla la tua email 📧',
        });
        navigate('/area-riservata');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Si è verificato un errore durante la registrazione',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/30 to-tech-cyan-light/30 flex items-center justify-center p-4">
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
              {showNewPasswordForm ? 'Nuova Password' : 'Area Riservata'}
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
                <CardDescription>
                  Scegli una password sicura di almeno 6 caratteri
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nuova Password</Label>
                    <PasswordInput
                      id="new-password"
                      placeholder="Minimo 6 caratteri"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Conferma Password</Label>
                    <PasswordInput
                      id="confirm-password"
                      placeholder="Ripeti la password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aggiornamento...
                      </>
                    ) : (
                      'Aggiorna Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : showResetPassword ? (
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Reimposta Password</CardTitle>
                <CardDescription>
                  Inserisci la tua email e ti invieremo un link per reimpostare la password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="mario@esempio.it"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      'Invia link di reset'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(false)}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Torna al login
                  </button>
                </form>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-border/50 shadow-lg">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Accedi</TabsTrigger>
                  <TabsTrigger value="signup">Registrati</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                {/* Login Tab */}
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {/* Login Mode Toggle */}
                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                      <button
                        type="button"
                        onClick={() => setLoginMode('parent')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          loginMode === 'parent' 
                            ? 'bg-background shadow text-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Genitore
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginMode('student')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          loginMode === 'student' 
                            ? 'bg-background shadow text-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4" />
                        Studente
                      </button>
                    </div>

                    {loginMode === 'parent' ? (
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="mario@esempio.it"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="login-username">Nome Utente</Label>
                        <Input
                          id="login-username"
                          type="text"
                          placeholder="Il tuo nome utente"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    )}
                    
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
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Accesso in corso...
                        </>
                      ) : (
                        'Accedi'
                      )}
                    </Button>
                    {loginMode === 'parent' && (
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(true)}
                        className="w-full text-center text-sm text-primary hover:underline mt-2"
                      >
                        Password dimenticata?
                      </button>
                    )}
                  </form>
                </TabsContent>

                {/* Signup Tab - Only for Parents */}
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    {/* Parent Info */}
                    <div className="space-y-3 pb-4 border-b">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Users className="w-4 h-4" />
                        I tuoi dati (Genitore)
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Nome Completo</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Mario Rossi"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="mario@esempio.it"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <PasswordInput
                          id="signup-password"
                          placeholder="Minimo 6 caratteri"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          minLength={6}
                        />
                      </div>
                    </div>

                    {/* Child Info */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-tech-teal">
                        <GraduationCap className="w-4 h-4" />
                        Dati del figlio/a (obbligatori)
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="child-name">Nome del figlio/a</Label>
                        <Input
                          id="child-name"
                          type="text"
                          placeholder="Luca"
                          value={childName}
                          onChange={(e) => setChildName(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="child-username">Nome utente per il login</Label>
                        <Input
                          id="child-username"
                          type="text"
                          placeholder="luca123"
                          value={childUsername}
                          onChange={(e) => setChildUsername(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Il figlio userà questo nome utente per accedere
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        Il figlio userà la stessa password del genitore per accedere
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="child-course">Corso acquistato</Label>
                        <Select value={childCourse} onValueChange={setChildCourse}>
                          <SelectTrigger id="child-course">
                            <SelectValue placeholder="Seleziona un corso (opzionale)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non ho ancora deciso</SelectItem>
                            {courses.map(course => (
                              <SelectItem key={course.id} value={course.id}>
                                {course.emoji} {course.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registrazione...
                        </>
                      ) : (
                        'Registrati'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
          )}

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Registrandoti accetti i nostri{' '}
            <a href="/termini" className="text-primary hover:underline">
              Termini e Condizioni
            </a>{' '}
            e la{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}