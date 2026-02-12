import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

interface LessonBalanceDisplayProps {
  studentId: string;
}

export function LessonBalanceDisplay({ studentId }: LessonBalanceDisplayProps) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('lesson_balance')
        .eq('id', studentId)
        .single();
      if (data) setBalance(data.lesson_balance);
    };
    if (studentId) fetch();
  }, [studentId]);

  if (balance === null) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Lezioni Rimanenti</p>
            <p className="text-3xl font-bold text-foreground">{balance}</p>
          </div>
          <CreditCard className="w-10 h-10 text-primary/30" />
        </div>
      </CardContent>
    </Card>
  );
}
