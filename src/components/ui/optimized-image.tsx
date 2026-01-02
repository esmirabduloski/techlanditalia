import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean; // If true, loads eagerly (for above-the-fold images)
  sizes?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  fallbackSrc?: string;
}

// Generate Unsplash URLs with different sizes and formats
function getOptimizedUrls(baseUrl: string) {
  // Parse Unsplash URL to get base
  const isUnsplash = baseUrl.includes('unsplash.com');
  
  if (!isUnsplash) {
    return {
      webp: { small: baseUrl, medium: baseUrl, large: baseUrl },
      fallback: { small: baseUrl, medium: baseUrl, large: baseUrl },
    };
  }

  // Remove existing params and add optimized ones
  const baseUrlClean = baseUrl.split('?')[0];
  
  return {
    webp: {
      small: `${baseUrlClean}?auto=format&fm=webp&fit=crop&w=400&q=75`,
      medium: `${baseUrlClean}?auto=format&fm=webp&fit=crop&w=800&q=80`,
      large: `${baseUrlClean}?auto=format&fm=webp&fit=crop&w=1200&q=85`,
    },
    fallback: {
      small: `${baseUrlClean}?auto=format&fit=crop&w=400&q=75`,
      medium: `${baseUrlClean}?auto=format&fit=crop&w=800&q=80`,
      large: `${baseUrlClean}?auto=format&fit=crop&w=1200&q=85`,
    },
  };
}

export function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  aspectRatio = 'auto',
  fallbackSrc,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const urls = getOptimizedUrls(src);

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  }[aspectRatio];

  if (hasError && fallbackSrc) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        className={cn(aspectRatioClass, className)}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden', aspectRatioClass)}>
      {/* Blur placeholder while loading */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted animate-pulse"
          aria-hidden="true"
        />
      )}

      {isInView && (
        <picture>
          {/* WebP sources for modern browsers */}
          <source
            type="image/webp"
            srcSet={`${urls.webp.small} 400w, ${urls.webp.medium} 800w, ${urls.webp.large} 1200w`}
            sizes={sizes}
          />
          {/* Fallback for older browsers */}
          <source
            srcSet={`${urls.fallback.small} 400w, ${urls.fallback.medium} 800w, ${urls.fallback.large} 1200w`}
            sizes={sizes}
          />
          <img
            src={urls.fallback.medium}
            alt={alt}
            className={cn(
              'transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        </picture>
      )}
    </div>
  );
}

// Preload critical images
export function preloadImage(src: string) {
  const urls = getOptimizedUrls(src);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/webp';
  link.href = urls.webp.large;
  document.head.appendChild(link);
}
