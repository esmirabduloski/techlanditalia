import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to generate signed URLs for private storage bucket files
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket (can be null/undefined)
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // If it's already a full URL (legacy data), use it directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      setSignedUrl(path);
      return;
    }

    const generateSignedUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);

        if (signedUrlError) {
          throw signedUrlError;
        }

        setSignedUrl(data.signedUrl);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to generate signed URL'));
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, isLoading, error };
}

/**
 * Utility function to generate a signed URL (non-hook version for callbacks)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!path) return null;

  // If it's already a full URL (legacy data), use it directly
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return null;
  }
}
