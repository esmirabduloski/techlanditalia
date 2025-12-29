interface GoogleSlidesEmbedProps {
  url: string;
  className?: string;
}

export function GoogleSlidesEmbed({ url, className = '' }: GoogleSlidesEmbedProps) {
  // Convert sharing URL to embed URL if needed
  const getEmbedUrl = (originalUrl: string): string => {
    // If already an embed URL, use it directly
    if (originalUrl.includes('/embed')) {
      return originalUrl;
    }
    
    // Extract presentation ID from various URL formats
    const patterns = [
      /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
      /\/d\/([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = originalUrl.match(pattern);
      if (match) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
      }
    }
    
    // Return original if can't parse
    return originalUrl;
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="aspect-video w-full rounded-lg overflow-hidden border border-border shadow-md">
        <iframe
          src={getEmbedUrl(url)}
          className="w-full h-full"
          frameBorder="0"
          allowFullScreen
          title="Google Slides Presentation"
        />
      </div>
    </div>
  );
}
