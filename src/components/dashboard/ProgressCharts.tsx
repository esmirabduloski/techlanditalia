import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity } from "lucide-react";

interface LessonProgress {
  id: string;
  lesson_id: string;
  completed_at: string;
  points_earned: number;
}

interface HomeworkSubmission {
  id: string;
  homework_id: string;
  status: string;
  submitted_at: string;
  points_earned: number;
}

interface TaskProgress {
  id: string;
  task_id: string;
  completed_at: string;
  points_earned: number;
}

interface ProgressChartsProps {
  lessonProgress: LessonProgress[];
  homeworkSubmissions: HomeworkSubmission[];
  taskProgress: TaskProgress[];
}

const pointsChartConfig: ChartConfig = {
  points: {
    label: "Punti",
    color: "hsl(var(--primary))",
  },
};

const activityChartConfig: ChartConfig = {
  lezioni: {
    label: "Lezioni",
    color: "hsl(var(--primary))",
  },
  compiti: {
    label: "Compiti",
    color: "hsl(var(--accent))",
  },
  task: {
    label: "Task",
    color: "hsl(var(--secondary))",
  },
};

export function ProgressCharts({
  lessonProgress,
  homeworkSubmissions,
  taskProgress,
}: ProgressChartsProps) {
  // Build weekly points data for the last 12 weeks
  const weeklyPointsData = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; points: number; start: Date; end: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);

      const weekLabel = `${start.getDate()}/${start.getMonth() + 1}`;
      let points = 0;

      lessonProgress.forEach((lp) => {
        const d = new Date(lp.completed_at);
        if (d >= start && d <= end) points += lp.points_earned;
      });
      homeworkSubmissions.forEach((hs) => {
        const d = new Date(hs.submitted_at);
        if (d >= start && d <= end) points += hs.points_earned;
      });
      taskProgress.forEach((tp) => {
        const d = new Date(tp.completed_at);
        if (d >= start && d <= end) points += tp.points_earned;
      });

      weeks.push({ label: weekLabel, points, start, end });
    }

    // Cumulative
    let cumulative = 0;
    return weeks.map((w) => {
      cumulative += w.points;
      return { name: w.label, points: cumulative };
    });
  }, [lessonProgress, homeworkSubmissions, taskProgress]);

  // Monthly activity comparison (current vs previous)
  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const count = (
      items: { completed_at?: string; submitted_at?: string }[],
      dateKey: "completed_at" | "submitted_at",
      from: Date,
      to: Date
    ) =>
      items.filter((i) => {
        const d = new Date(i[dateKey] as string);
        return d >= from && d <= to;
      }).length;

    const thisLessons = count(lessonProgress, "completed_at", thisMonthStart, now);
    const prevLessons = count(lessonProgress, "completed_at", prevMonthStart, prevMonthEnd);
    const thisHomework = count(homeworkSubmissions, "submitted_at", thisMonthStart, now);
    const prevHomework = count(homeworkSubmissions, "submitted_at", prevMonthStart, prevMonthEnd);
    const thisTasks = count(taskProgress, "completed_at", thisMonthStart, now);
    const prevTasks = count(taskProgress, "completed_at", prevMonthStart, prevMonthEnd);

    const thisPoints =
      lessonProgress.filter((l) => new Date(l.completed_at) >= thisMonthStart).reduce((s, l) => s + l.points_earned, 0) +
      homeworkSubmissions.filter((h) => new Date(h.submitted_at) >= thisMonthStart).reduce((s, h) => s + h.points_earned, 0) +
      taskProgress.filter((t) => new Date(t.completed_at) >= thisMonthStart).reduce((s, t) => s + t.points_earned, 0);

    const prevPoints =
      lessonProgress.filter((l) => { const d = new Date(l.completed_at); return d >= prevMonthStart && d <= prevMonthEnd; }).reduce((s, l) => s + l.points_earned, 0) +
      homeworkSubmissions.filter((h) => { const d = new Date(h.submitted_at); return d >= prevMonthStart && d <= prevMonthEnd; }).reduce((s, h) => s + h.points_earned, 0) +
      taskProgress.filter((t) => { const d = new Date(t.completed_at); return d >= prevMonthStart && d <= prevMonthEnd; }).reduce((s, t) => s + t.points_earned, 0);

    return {
      thisMonth: { lezioni: thisLessons, compiti: thisHomework, task: thisTasks, punti: thisPoints },
      prevMonth: { lezioni: prevLessons, compiti: prevHomework, task: prevTasks, punti: prevPoints },
    };
  }, [lessonProgress, homeworkSubmissions, taskProgress]);

  // Weekly activity bars (last 8 weeks)
  const weeklyActivityData = useMemo(() => {
    const now = new Date();
    const data: { name: string; lezioni: number; compiti: number; task: number }[] = [];

    for (let i = 7; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);

      const weekLabel = `${start.getDate()}/${start.getMonth() + 1}`;

      const lezioni = lessonProgress.filter((l) => {
        const d = new Date(l.completed_at);
        return d >= start && d <= end;
      }).length;
      const compiti = homeworkSubmissions.filter((h) => {
        const d = new Date(h.submitted_at);
        return d >= start && d <= end;
      }).length;
      const task = taskProgress.filter((t) => {
        const d = new Date(t.completed_at);
        return d >= start && d <= end;
      }).length;

      data.push({ name: weekLabel, lezioni, compiti, task });
    }

    return data;
  }, [lessonProgress, homeworkSubmissions, taskProgress]);

  const TrendIcon = ({ current, previous }: { current: number; previous: number }) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-primary" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "—";
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
  ];
  const now = new Date();
  const thisMonthName = months[now.getMonth()];
  const prevMonthName = months[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        Progressi e Statistiche
      </h2>

      {/* Month Comparison Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Punti", key: "punti" as const, emoji: "⭐" },
          { label: "Lezioni", key: "lezioni" as const, emoji: "📚" },
          { label: "Compiti", key: "compiti" as const, emoji: "📝" },
          { label: "Task", key: "task" as const, emoji: "✅" },
        ]).map(({ label, key, emoji }) => (
          <Card key={key} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{emoji} {label}</span>
                <TrendIcon
                  current={monthComparison.thisMonth[key]}
                  previous={monthComparison.prevMonth[key]}
                />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {monthComparison.thisMonth[key]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {prevMonthName}: {monthComparison.prevMonth[key]}{" "}
                <span
                  className={
                    monthComparison.thisMonth[key] > monthComparison.prevMonth[key]
                      ? "text-primary font-medium"
                      : monthComparison.thisMonth[key] < monthComparison.prevMonth[key]
                      ? "text-destructive font-medium"
                      : ""
                  }
                >
                  ({getChangePercent(monthComparison.thisMonth[key], monthComparison.prevMonth[key])})
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Points Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Punti nel Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pointsChartConfig} className="aspect-[16/9] w-full">
              <AreaChart data={weeklyPointsData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pointsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="hsl(var(--primary))"
                  fill="url(#pointsGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weekly Activity Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              Attività Settimanale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={activityChartConfig} className="aspect-[16/9] w-full">
              <BarChart data={weeklyActivityData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="lezioni" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="compiti" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="task" fill="hsl(var(--secondary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
