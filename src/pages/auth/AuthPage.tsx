import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Rocket, Users, GraduationCap, KeyRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function AuthPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'parent' | 'student'>('student');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Redirect authenticated users
  useEffect(() => {
    if (!authLoading && user && !showNewPasswordForm) {
      // Admin users go to admin panel, others go to area riservata
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
      // Debug: log all URL parts
      console.log('Recovery check - Full URL:', window.location.href);
      console.log('Recovery check - Hash:', window.location.hash);
      console.log('Recovery check - Search:', window.location.search);
      
      // Check URL hash for recovery token (Supabase format: #access_token=...&type=recovery)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const hashType = hashParams.get('type');
      
      // Also check query params (alternative format: ?type=recovery)
      const queryType = searchParams.get('type');
      const resetParam = searchParams.get('reset');
      
      console.log('Recovery check - accessToken:', !!accessToken, 'hashType:', hashType, 'queryType:', queryType, 'resetParam:', resetParam);
      
      if ((hashType === 'recovery' && accessToken) || queryType === 'recovery') {
        console.log('Recovery detected! Showing new password form');
        setShowNewPasswordForm(true);
        // Clear the hash from URL for cleaner display
        window.history.replaceState(null, '', '/auth?reset=true');
      }
    };
    
    checkRecoverySession();
    
    // Listen for PASSWORD_RECOVERY event from Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session ? 'with session' : 'no session');
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event received!');
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
    } catch (error) {
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
      // Call our custom edge function to send branded email
      const { data, error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { 
          email: email.trim().toLowerCase(),
          redirectUrl: `${window.location.origin}/auth?reset=true`
        }
      });

      if (error) {
        console.error('Reset password error:', error);
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
    } catch (error) {
      console.error('Reset password catch error:', error);
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
        // Navigation is handled by useEffect based on isAdmin
      }
    } catch (error) {
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
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/area-riservata`,
          data: {
            full_name: fullName,
            role: role,
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
      } else {
        // Send welcome email in background (non-blocking)
        supabase.functions.invoke('send-welcome-email', {
          body: { email, fullName, role }
        }).catch(err => console.error('Welcome email error:', err));

        toast({
          title: 'Registrazione completata!',
          description: 'Benvenuto nella famiglia TECHLAND! Controlla la tua email 📧',
        });
        navigate('/area-riservata');
      }
    } catch (error) {
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

          {/* New Password Form - After clicking reset link */}
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
                    <Input
                      id="new-password"
                      type="password"
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
                    <Input
                      id="confirm-password"
                      type="password"
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
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={6}
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
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(true)}
                      className="w-full text-center text-sm text-primary hover:underline mt-2"
                    >
                      Password dimenticata?
                    </button>
                  </form>
                </TabsContent>

                {/* Signup Tab */}
                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
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
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Minimo 6 caratteri"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Chi sei?</Label>
                      <RadioGroup
                        value={role}
                        onValueChange={(value) => setRole(value as 'parent' | 'student')}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div>
                          <RadioGroupItem
                            value="student"
                            id="student"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="student"
                            className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                          >
                            <GraduationCap className="mb-2 h-6 w-6" />
                            <span className="text-sm font-medium">Studente</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="parent"
                            id="parent"
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor="parent"
                            className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 cursor-pointer transition-all"
                          >
                            <Users className="mb-2 h-6 w-6" />
                            <span className="text-sm font-medium">Genitore</span>
                          </Label>
                        </div>
                      </RadioGroup>
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
