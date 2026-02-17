import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle2, ShoppingCart, Loader2, XCircle, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  type: string;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  metadata: Record<string, string>;
  prices: StripePrice[];
}

export default function Acquisti() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-get-products');
      if (error) throw error;
      setProducts(data.products || []);
    } catch (err: any) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i prodotti. Riprova più tardi.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    try {
      const currentUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          priceId,
          successUrl: `${currentUrl}/area-riservata/acquisti?success=true`,
          cancelUrl: `${currentUrl}/area-riservata/acquisti?canceled=true`,
        },
      });
      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({
        title: 'Errore',
        description: 'Impossibile avviare il pagamento. Riprova.',
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/20 to-tech-cyan-light/20 dark:from-background dark:via-background dark:to-background">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/area-riservata">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-7 h-7 text-primary" />
                Acquista Corsi
              </h1>
              <p className="text-muted-foreground">
                Scegli il corso o servizio che fa per te
              </p>
            </div>
          </div>

          {/* Success Message */}
          {isSuccess && (
            <Card className="mb-8 border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-300">Pagamento completato!</h3>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Grazie per il tuo acquisto. Riceverai una conferma via email.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Canceled Message */}
          {isCanceled && (
            <Card className="mb-8 border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-800 dark:text-orange-300">Pagamento annullato</h3>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      Il pagamento è stato annullato. Puoi riprovare quando vuoi.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-40 w-full rounded-md" />
                    <Skeleton className="h-6 w-3/4 mt-4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && products.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nessun prodotto disponibile
                </h3>
                <p className="text-muted-foreground">
                  I corsi e servizi saranno disponibili a breve. Torna presto!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Products Grid */}
          {!loading && products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const price = product.prices[0];
                return (
                  <Card key={product.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    {/* Product Image */}
                    {product.images?.[0] && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="flex-1">
                      <CardTitle className="text-xl">{product.name}</CardTitle>
                      {product.description && (
                        <CardDescription className="text-sm leading-relaxed">
                          {product.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardFooter className="flex items-center justify-between pt-0">
                      <div>
                        <span className="text-2xl font-bold text-primary">
                          {formatPrice(price.unit_amount, price.currency)}
                        </span>
                        {price.recurring && (
                          <span className="text-sm text-muted-foreground ml-1">
                            /{price.recurring.interval === 'month' ? 'mese' : price.recurring.interval === 'year' ? 'anno' : price.recurring.interval}
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleCheckout(price.id)}
                        disabled={checkoutLoading === price.id}
                        className="ml-4"
                      >
                        {checkoutLoading === price.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <ShoppingCart className="w-4 h-4 mr-2" />
                        )}
                        Acquista
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
