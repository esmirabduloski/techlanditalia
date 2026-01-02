import { useState, useEffect } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Loader2, TrendingUp, MousePointer, Clock, Target, Eye, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';

interface AnalyticsEvent {
  event_type: string;
  event_category: string;
  event_action: string;
  event_label: string | null;
  created_at: string;
  page_url: string;
  metadata: unknown;
}

interface PageView {
  page_url: string;
  time_on_page: number | null;
  scroll_depth: number | null;
  entered_at: string;
  device_type: string;
}

interface ConversionFunnel {
  funnel_name: string;
  step_number: number;
  step_name: string;
  completed: boolean;
  created_at: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminAnalytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [funnelData, setFunnelData] = useState<ConversionFunnel[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    const startDate = startOfDay(subDays(new Date(), parseInt(dateRange)));
    const endDate = endOfDay(new Date());

    try {
      const [eventsRes, pageViewsRes, funnelRes] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('page_views')
          .select('*')
          .gte('entered_at', startDate.toISOString())
          .lte('entered_at', endDate.toISOString())
          .order('entered_at', { ascending: false }),
        supabase
          .from('conversion_funnels')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })
      ]);

      if (eventsRes.data) setEvents(eventsRes.data);
      if (pageViewsRes.data) setPageViews(pageViewsRes.data);
      if (funnelRes.data) setFunnelData(funnelRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics
  const totalPageViews = pageViews.length;
  const uniqueSessions = new Set(pageViews.map(pv => pv.device_type)).size;
  const avgTimeOnPage = pageViews.filter(pv => pv.time_on_page).reduce((acc, pv) => acc + (pv.time_on_page || 0), 0) / (pageViews.filter(pv => pv.time_on_page).length || 1);
  const avgScrollDepth = pageViews.filter(pv => pv.scroll_depth).reduce((acc, pv) => acc + (pv.scroll_depth || 0), 0) / (pageViews.filter(pv => pv.scroll_depth).length || 1);

  // CTA clicks
  const ctaClicks = events.filter(e => e.event_type === 'cta_click');
  const ctaByLabel = ctaClicks.reduce((acc, e) => {
    const label = e.event_label || 'unknown';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Booking conversions
  const bookingConversions = events.filter(e => e.event_type === 'booking_conversion').length;
  const formStarts = events.filter(e => e.event_type === 'form_start' && e.event_label === 'booking_form').length;
  const conversionRate = formStarts > 0 ? ((bookingConversions / formStarts) * 100).toFixed(1) : '0';

  // Page views by page
  const pageViewsByUrl = pageViews.reduce((acc, pv) => {
    acc[pv.page_url] = (acc[pv.page_url] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topPages = Object.entries(pageViewsByUrl)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  // Daily page views chart data
  const dailyViews = pageViews.reduce((acc, pv) => {
    const date = format(new Date(pv.entered_at), 'dd MMM', { locale: it });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dailyViewsData = Object.entries(dailyViews)
    .map(([date, views]) => ({ date, views }))
    .reverse();

  // Lesson time data
  const lessonEvents = events.filter(e => e.event_type === 'lesson_complete');
  const avgLessonTime = lessonEvents.length > 0
    ? lessonEvents.reduce((acc, e) => acc + (((e.metadata as Record<string, unknown>)?.time_spent_seconds as number) || 0), 0) / lessonEvents.length
    : 0;

  // Device breakdown
  const deviceBreakdown = pageViews.reduce((acc, pv) => {
    acc[pv.device_type] = (acc[pv.device_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deviceData = Object.entries(deviceBreakdown).map(([name, value]) => ({ name, value }));

  // Funnel analysis
  const bookingFunnel = funnelData.filter(f => f.funnel_name === 'booking_funnel');
  const funnelSteps = [
    { step: 1, name: 'Visita Pagina', count: bookingFunnel.filter(f => f.step_number === 1).length },
    { step: 2, name: 'Inizio Form', count: bookingFunnel.filter(f => f.step_number === 2).length },
    { step: 3, name: 'Tentativo Invio', count: bookingFunnel.filter(f => f.step_number === 3).length },
    { step: 4, name: 'Conversione', count: bookingFunnel.filter(f => f.step_number === 4 && f.completed).length },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminNav />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics & Tracking</h1>
            <p className="text-muted-foreground">Monitora conversioni, engagement e comportamento utenti</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="14">Ultimi 14 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Visualizzazioni</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPageViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Pagine visualizzate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversioni Booking</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bookingConversions}</div>
              <div className="flex items-center text-xs">
                <Badge variant={parseFloat(conversionRate) > 5 ? "default" : "secondary"} className="text-xs">
                  {conversionRate}% tasso conv.
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tempo Medio Pagina</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(avgTimeOnPage)}s</div>
              <p className="text-xs text-muted-foreground">Scroll medio: {Math.round(avgScrollDepth)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tempo Medio Lezioni</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(avgLessonTime / 60)}min</div>
              <p className="text-xs text-muted-foreground">{lessonEvents.length} lezioni completate</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="cta">CTA & Click</TabsTrigger>
            <TabsTrigger value="funnel">Funnel Conversione</TabsTrigger>
            <TabsTrigger value="pages">Pagine</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Views Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Visualizzazioni Giornaliere</CardTitle>
                  <CardDescription>Andamento visite nel periodo selezionato</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyViewsData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="views" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Device Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Dispositivi</CardTitle>
                  <CardDescription>Distribuzione per tipo di dispositivo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deviceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {deviceData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Click sui CTA</CardTitle>
                <CardDescription>Performance dei pulsanti call-to-action</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={Object.entries(ctaByLabel).map(([name, clicks]) => ({ name, clicks }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis type="category" dataKey="name" className="text-xs" width={150} />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(ctaByLabel).slice(0, 6).map(([label, count]) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium truncate">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4 text-primary" />
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-xs text-muted-foreground">click</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Funnel Prenotazione</CardTitle>
                <CardDescription>Analisi del percorso di conversione booking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelSteps}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {funnelSteps.map((step, index) => {
                const prevCount = index > 0 ? funnelSteps[index - 1].count : step.count;
                const dropoff = prevCount > 0 ? ((prevCount - step.count) / prevCount * 100).toFixed(1) : '0';
                const isImproved = parseFloat(dropoff) < 30;

                return (
                  <Card key={step.step}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{step.step}</Badge>
                        <CardTitle className="text-sm font-medium">{step.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{step.count}</div>
                      {index > 0 && (
                        <div className={`flex items-center text-xs ${isImproved ? 'text-green-600' : 'text-red-500'}`}>
                          {isImproved ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {dropoff}% drop-off
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="pages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pagine Più Visitate</CardTitle>
                <CardDescription>Top 10 pagine per numero di visualizzazioni</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPages.map((page, index) => (
                    <div key={page.url} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                          {index + 1}
                        </Badge>
                        <span className="text-sm font-medium truncate max-w-md">{page.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{page.count}</span>
                        <span className="text-xs text-muted-foreground">views</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
