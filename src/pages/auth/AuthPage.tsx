import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Rocket, Users, GraduationCap } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'parent' | 'student'>('student');
  const navigate = useNavigate();
  const { toast } = useToast();

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
        navigate('/area-riservata');
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
        toast({
          title: 'Registrazione completata!',
          description: 'Benvenuto nella famiglia TECHLAND!',
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
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Area Riservata</h1>
            <p className="text-muted-foreground">
              Accedi per vedere i tuoi corsi e progressi
            </p>
          </div>

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
