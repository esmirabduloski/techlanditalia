import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle2, ShoppingCart, Loader2, XCircle, Sparkles, GraduationCap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AcquistiBenefits } from '@/components/acquisti/AcquistiBenefits';
import { AcquistiFAQ } from '@/components/acquisti/AcquistiFAQ';
import { AcquistiFilters } from '@/components/acquisti/AcquistiFilters';
import { ProductCard } from '@/components/acquisti/ProductCard';

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

interface Course {
  id: string;
  slug: string;
  title: string;
  age_range: string | null;
}

export default function Acquisti() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [ageFilter, setAgeFilter] = useState("Tutti");

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchProducts();
    fetchCourses();
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

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, slug, title, age_range')
      .eq('is_visible', true);
    if (data) setCourses(data);
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

  // Age range filtering logic (same as /corsi)
  const parseAgeRange = (ageRange: string | null): [number, number] | null => {
    if (!ageRange) return null;
    const match = ageRange.match(/(\d+)-(\d+)/);
    return match ? [parseInt(match[1]), parseInt(match[2])] : null;
  };

  const rangesOverlap = (a: [number, number], b: [number, number]) =>
    a[0] <= b[1] && a[1] >= b[0];

  // Match products to courses by name similarity, then filter by age
  const getProductCourseAgeRange = (product: StripeProduct): string | null => {
    // Check metadata first for explicit age_range or course_slug
    if (product.metadata?.age_range) return product.metadata.age_range;
    if (product.metadata?.course_slug) {
      const course = courses.find(c => c.slug === product.metadata.course_slug);
      return course?.age_range || null;
    }
    // Fuzzy match: check if any significant word from the product name appears in a course title
    const productWords = product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const match = courses.find(c => {
      const titleLower = c.title.toLowerCase();
      return productWords.some(word => titleLower.includes(word));
    });
    return match?.age_range || null;
  };

  const filteredProducts = products.filter((product) => {
    if (ageFilter === "Tutti") return true;
    const ageRange = getProductCourseAgeRange(product);
    const courseRange = parseAgeRange(ageRange);
    const filterRange = parseAgeRange(ageFilter + " anni");
    if (!courseRange || !filterRange) return true; // show if no age data
    return rangesOverlap(courseRange, filterRange);
  });

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
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/area-riservata">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="w-7 h-7 text-primary" />
                Investi nel futuro di tuo figlio
              </h1>
              <p className="text-muted-foreground">
                Scegli il percorso di programmazione perfetto per il tuo ragazzo
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-sm text-muted-foreground mb-8 ml-14">
            🎯 Oltre <strong>500 famiglie</strong> hanno già scelto TECHLAND per i loro figli
          </p>

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

          {/* Benefits */}
          <AcquistiBenefits />

          {/* Filters */}
          <AcquistiFilters ageFilter={ageFilter} onAgeFilterChange={setAgeFilter} />

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <div className="h-1.5 w-full bg-muted" />
                  <div className="p-6">
                    <Skeleton className="h-44 w-full rounded-md mb-4" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-10 w-full mt-6" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProducts.length === 0 && products.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nessun corso per questa fascia d'età
                </h3>
                <p className="text-muted-foreground mb-4">
                  Prova a cambiare il filtro per trovare il corso giusto.
                </p>
                <Button variant="outline" onClick={() => setAgeFilter("Tutti")}>
                  Mostra tutti i corsi
                </Button>
              </CardContent>
            </Card>
          )}

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
          {!loading && filteredProducts.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {filteredProducts.length} {filteredProducts.length === 1 ? "corso disponibile" : "corsi disponibili"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    checkoutLoading={checkoutLoading}
                    onCheckout={handleCheckout}
                    featured={index === 0 && filteredProducts.length > 1}
                  />
                ))}
              </div>
            </>
          )}

          {/* FAQ */}
          <AcquistiFAQ />
        </div>
      </div>
    </Layout>
  );
}
