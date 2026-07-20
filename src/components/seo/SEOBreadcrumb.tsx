import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Head } from "vite-react-ssg";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SEOBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const SEOBreadcrumb = ({ items, className = "" }: SEOBreadcrumbProps) => {
  // Build full breadcrumb list with Home
  const fullItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    ...items
  ];

  // Generate Schema.org BreadcrumbList
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": fullItems.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      ...(item.href && {
        "item": `https://techlanditalia.it${item.href}`
      })
    }))
  };

  return (
    <>
      <Head defer={false}>
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Head>
      
      <nav 
        aria-label="Breadcrumb" 
        className={`flex items-center text-sm text-muted-foreground ${className}`}
      >
        <ol className="flex flex-wrap items-center gap-1.5" itemScope itemType="https://schema.org/BreadcrumbList">
          {fullItems.map((item, index) => {
            const isLast = index === fullItems.length - 1;
            const isHome = index === 0;

            return (
              <li 
                key={index} 
                className="inline-flex items-center gap-1.5"
                itemProp="itemListElement" 
                itemScope 
                itemType="https://schema.org/ListItem"
              >
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                )}
                
                {isLast ? (
                  <span 
                    className="font-medium text-foreground"
                    itemProp="name"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link
                    to={item.href}
                    className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    itemProp="item"
                  >
                    {isHome && <Home className="h-4 w-4" aria-hidden="true" />}
                    <span itemProp="name">{isHome ? <span className="sr-only">Home</span> : item.label}</span>
                  </Link>
                ) : (
                  <span itemProp="name">{item.label}</span>
                )}
                
                <meta itemProp="position" content={String(index + 1)} />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};
