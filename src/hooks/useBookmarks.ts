import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Bookmark {
  id: string;
  entity_type: 'lesson' | 'task';
  entity_id: string;
  course_id: string | null;
  created_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    if (!user) { setBookmarks([]); setIsLoading(false); return; }
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setBookmarks((data as Bookmark[]) || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const isBookmarked = useCallback((entityType: 'lesson' | 'task', entityId: string) => {
    return bookmarks.some(b => b.entity_type === entityType && b.entity_id === entityId);
  }, [bookmarks]);

  const toggleBookmark = useCallback(async (entityType: 'lesson' | 'task', entityId: string, courseId?: string) => {
    if (!user) return;
    const existing = bookmarks.find(b => b.entity_type === entityType && b.entity_id === entityId);
    if (existing) {
      await supabase.from('bookmarks').delete().eq('id', existing.id);
      setBookmarks(prev => prev.filter(b => b.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('bookmarks')
        .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId, course_id: courseId || null } as any)
        .select()
        .single();
      if (data) setBookmarks(prev => [data as Bookmark, ...prev]);
    }
  }, [user, bookmarks]);

  return { bookmarks, isLoading, isBookmarked, toggleBookmark, refetch: fetchBookmarks };
}
