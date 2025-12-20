import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useHasEnrollments() {
  const { user } = useAuth();
  const [hasEnrollments, setHasEnrollments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkEnrollments() {
      if (!user) {
        setHasEnrollments(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", user.id)
          .eq("status", "active")
          .limit(1);

        if (error) {
          console.error("Error checking enrollments:", error);
          setHasEnrollments(false);
        } else {
          setHasEnrollments(data && data.length > 0);
        }
      } catch (err) {
        console.error("Error checking enrollments:", err);
        setHasEnrollments(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkEnrollments();
  }, [user]);

  return { hasEnrollments, isLoading };
}
