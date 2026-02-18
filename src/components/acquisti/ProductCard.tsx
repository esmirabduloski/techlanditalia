import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2, Star, Zap } from "lucide-react";

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

interface ProductCardProps {
  product: StripeProduct;
  checkoutLoading: string | null;
  onCheckout: (priceId: string) => void;
  featured?: boolean;
}

const formatPrice = (amount: number, currency: string) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export function ProductCard({ product, checkoutLoading, onCheckout, featured }: ProductCardProps) {
  const price = product.prices[0];
  const hasPromo = product.metadata?.promo === "true";
  const originalPrice = product.metadata?.original_price
    ? parseInt(product.metadata.original_price)
    : null;

  return (
    <Card
      className={`flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 relative ${
        featured
          ? "border-2 border-primary shadow-lg ring-2 ring-primary/20 hover:shadow-xl"
          : "hover:shadow-lg border-border/60"
      }`}
    >
      {/* Badges */}
      {featured && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-primary text-primary-foreground gap-1 shadow-md">
            <Star className="w-3 h-3" /> Più popolare
          </Badge>
        </div>
      )}
      {hasPromo && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-secondary text-secondary-foreground gap-1 shadow-md">
            <Zap className="w-3 h-3" /> Offerta
          </Badge>
        </div>
      )}

      {/* Gradient accent top */}
      <div
        className={`h-1.5 w-full ${
          featured
            ? "bg-gradient-to-r from-primary via-accent to-secondary"
            : "bg-gradient-to-r from-primary/40 to-accent/40"
        }`}
      />

      {/* Product Image */}
      {product.images?.[0] && (
        <div className="h-44 overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      )}

      <CardHeader className="flex-1 pb-3">
        <CardTitle className="text-lg">{product.name}</CardTitle>
        {product.description && (
          <CardDescription className="text-sm leading-relaxed line-clamp-3">
            {product.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardFooter className="flex flex-col items-stretch gap-3 pt-0">
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">
            {formatPrice(price.unit_amount, price.currency)}
          </span>
          {originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(originalPrice, price.currency)}
            </span>
          )}
          {price.recurring && (
            <span className="text-sm text-muted-foreground">
              /{price.recurring.interval === "month" ? "mese" : price.recurring.interval === "year" ? "anno" : price.recurring.interval}
            </span>
          )}
        </div>

        {/* CTA */}
        <Button
          onClick={() => onCheckout(price.id)}
          disabled={checkoutLoading === price.id}
          size="lg"
          variant={featured ? "hero" : "default"}
          className="w-full"
        >
          {checkoutLoading === price.id ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <ShoppingCart className="w-4 h-4 mr-2" />
          )}
          Acquista ora
        </Button>
      </CardFooter>
    </Card>
  );
}
