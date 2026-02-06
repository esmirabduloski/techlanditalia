import { TechlandLogo } from './TechlandLogo';
import { GoogleSlidesEmbed } from './GoogleSlidesEmbed';
import DOMPurify from 'dompurify';

interface LessonContentProps {
  title: string;
  lessonTitle?: string | null;
  description?: string | null;
  content?: string | null;
  contentType?: string;
  videoUrl?: string | null;
  slidesUrl?: string | null;
  images?: string[];
}

export function LessonContent({
  title,
  lessonTitle,
  description,
  content,
  contentType = 'text',
  videoUrl,
  slidesUrl,
  images = [],
}: LessonContentProps) {
  const getVideoEmbedUrl = (url: string): string => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    return url;
  };

  const renderContent = () => {
    const sanitizedContent = content ? DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'img', 'video', 'iframe', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel', 'style', 'controls', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'allowtransparency', 'scrolling'],
      ALLOW_DATA_ATTR: false
    }) : '';
    return (
      <div className="space-y-6">
        {/* Text Content */}
        {content && (
          <div 
            className="prose prose-lg max-w-none dark:prose-invert
              prose-headings:text-foreground 
              prose-p:text-foreground/90
              prose-a:text-primary hover:prose-a:text-primary/80
              prose-strong:text-foreground
              prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            "
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        )}

        {/* Video */}
        {videoUrl && (
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-border shadow-md">
            <iframe
              src={getVideoEmbedUrl(videoUrl)}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video"
            />
          </div>
        )}

        {/* Google Slides */}
        {slidesUrl && (
          <GoogleSlidesEmbed url={slidesUrl} />
        )}

        {/* Images */}
        {images.length > 0 && (
          <div className="grid gap-4">
            {images.map((imageUrl, index) => (
              <img
                key={index}
                src={imageUrl}
                alt={`Immagine ${index + 1}`}
                className="w-full rounded-lg border border-border shadow-sm"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Logo */}
      <div className="mb-6">
        <TechlandLogo />
      </div>

      {/* Lesson Title */}
      {lessonTitle && (
        <p className="text-sm font-medium text-muted-foreground mb-1">
          📖 {lessonTitle}
        </p>
      )}

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
        {title}
      </h1>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground mb-6">{description}</p>
      )}

      {/* Main Content */}
      {renderContent()}
    </div>
  );
}
