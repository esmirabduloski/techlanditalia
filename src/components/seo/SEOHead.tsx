import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
  };
  noIndex?: boolean;
  structuredData?: object | object[];
  schemaData?: object | object[];
}

const BASE_URL = "https://techlanditalia.it";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

export function SEOHead({
  title,
  description,
  canonical,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  article,
  noIndex = false,
  structuredData,
  schemaData,
}: SEOHeadProps) {
  const fullTitle = title.includes("TECHLAND") ? title : `${title} | TECHLAND`;
  const canonicalUrl = canonical?.startsWith("http") ? canonical : canonical ? `${BASE_URL}${canonical}` : undefined;

  // Ensure description is within limits
  const truncatedDescription = description.length > 160 
    ? description.substring(0, 157) + "..." 
    : description;
  
  // Combine schema data
  const allSchemaData = schemaData || structuredData;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={truncatedDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Hreflang */}
      {canonicalUrl && <link rel="alternate" hrefLang="it" href={canonicalUrl} />}
      {canonicalUrl && <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl || BASE_URL} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="it_IT" />
      <meta property="og:site_name" content="TECHLAND" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl || BASE_URL} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={truncatedDescription} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Article specific */}
      {article && ogType === "article" && (
        <>
          {article.publishedTime && (
            <meta property="article:published_time" content={article.publishedTime} />
          )}
          {article.modifiedTime && (
            <meta property="article:modified_time" content={article.modifiedTime} />
          )}
          {article.author && <meta property="article:author" content={article.author} />}
          {article.section && <meta property="article:section" content={article.section} />}
        </>
      )}
      
      {/* Structured Data */}
      {allSchemaData && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(allSchemaData) ? allSchemaData : [allSchemaData])}
        </script>
      )}
    </Helmet>
  );
}

// Schema.org structured data generators
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "TECHLAND",
  "alternateName": ["TECHLAND Italia", "Techland", "Techland Corsi", "Techland Coding"],
  "url": "https://techlanditalia.it",
  "logo": "https://techlanditalia.it/logo.png",
  "description": "TECHLAND è la scuola di coding online per bambini e ragazzi dai 6 ai 18 anni. Corsi di programmazione in piccoli gruppi con docenti esperti.",
  "foundingDate": "2019",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+39-350-581-3140",
    "contactType": "customer service",
    "email": "info@techlanditalia.it",
    "availableLanguage": "Italian"
  },
  "sameAs": [
    "https://www.facebook.com/profile.php?id=61573749912297",
    "https://www.instagram.com/techlanditalia/",
    "https://www.linkedin.com/in/techlanditalia/"
  ],
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "IT"
  },
  "areaServed": {
    "@type": "Country",
    "name": "Italia"
  }
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "TECHLAND",
  "url": "https://techlanditalia.it",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://techlanditalia.it/corsi?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export function generateCourseSchema(course: {
  title: string;
  description: string;
  age: string;
  level: string;
  duration: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": course.title,
    "description": course.description,
    "provider": {
      "@type": "EducationalOrganization",
      "@id": "https://techlanditalia.it/#organization",
      "name": "TECHLAND",
      "url": "https://techlanditalia.it"
    },
    "url": `https://techlanditalia.it/corsi/${course.slug}`,
    "inLanguage": "it-IT",
    "audience": {
      "@type": "EducationalAudience",
      "educationalRole": "student",
      "audienceType": `Bambini e ragazzi ${course.age}`
    },
    "educationalLevel": course.level,
    "timeRequired": course.duration,
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "inLanguage": "it-IT"
    },
    "offers": {
      "@type": "Offer",
      "category": "Lezione di prova gratuita",
      "price": "0",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "url": "https://techlanditalia.it/prenota"
    }

  };
}

export function generateBlogPostSchema(post: {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  author?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.description,
    "url": `https://techlanditalia.it/blog/${post.slug}`,
    "datePublished": post.datePublished,
    "dateModified": post.dateModified || post.datePublished,
    "image": post.image || "https://techlanditalia.it/og-image.png",
    "author": {
      "@type": "Organization",
      "name": post.author || "TECHLAND"
    },
    "publisher": {
      "@type": "Organization",
      "name": "TECHLAND",
      "logo": {
        "@type": "ImageObject",
        "url": "https://techlanditalia.it/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://techlanditalia.it/blog/${post.slug}`
    }
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://techlanditalia.it${item.url}`
    }))
  };
}
