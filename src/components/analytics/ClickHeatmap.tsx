import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClickData {
  click_x: number | null;
  click_y: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
  page_url: string;
  element_selector: string | null;
  event_label: string | null;
}

interface ClickHeatmapProps {
  clicks: ClickData[];
  selectedPage: string;
  onPageChange: (page: string) => void;
  availablePages: string[];
}

// Grid configuration
const GRID_COLS = 12;
const GRID_ROWS = 8;

export function ClickHeatmap({ clicks, selectedPage, onPageChange, availablePages }: ClickHeatmapProps) {
  // Filter clicks for selected page that have position data
  const pageClicks = useMemo(() => 
    clicks.filter(c => 
      c.page_url === selectedPage && 
      c.click_x !== null && 
      c.click_y !== null &&
      c.viewport_width !== null &&
      c.viewport_height !== null
    ), [clicks, selectedPage]
  );

  // Create heatmap grid
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(0));
    
    pageClicks.forEach(click => {
      if (click.click_x === null || click.click_y === null || 
          click.viewport_width === null || click.viewport_height === null) return;
      
      // Normalize position to percentage
      const xPercent = click.click_x / click.viewport_width;
      const yPercent = Math.min(click.click_y / click.viewport_height, 1);
      
      // Map to grid cell
      const col = Math.min(Math.floor(xPercent * GRID_COLS), GRID_COLS - 1);
      const row = Math.min(Math.floor(yPercent * GRID_ROWS), GRID_ROWS - 1);
      
      if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
        grid[row][col]++;
      }
    });
    
    return grid;
  }, [pageClicks]);

  // Find max value for color scaling
  const maxClicks = useMemo(() => 
    Math.max(...heatmapGrid.flat(), 1), [heatmapGrid]
  );

  // Get top clicked elements
  const topElements = useMemo(() => {
    const elementCounts: Record<string, { count: number; label: string }> = {};
    
    pageClicks.forEach(click => {
      const key = click.element_selector || click.event_label || 'unknown';
      const label = click.event_label || click.element_selector || 'Unknown Element';
      if (!elementCounts[key]) {
        elementCounts[key] = { count: 0, label };
      }
      elementCounts[key].count++;
    });
    
    return Object.entries(elementCounts)
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [pageClicks]);

  // Get color based on intensity
  const getHeatColor = (value: number): string => {
    if (value === 0) return 'bg-muted/30';
    const intensity = value / maxClicks;
    if (intensity < 0.2) return 'bg-blue-200 dark:bg-blue-900/50';
    if (intensity < 0.4) return 'bg-green-300 dark:bg-green-800/60';
    if (intensity < 0.6) return 'bg-yellow-300 dark:bg-yellow-700/70';
    if (intensity < 0.8) return 'bg-orange-400 dark:bg-orange-600/80';
    return 'bg-red-500 dark:bg-red-500/90';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Heatmap Click</CardTitle>
              <CardDescription>Visualizzazione delle aree più cliccate</CardDescription>
            </div>
            <Select value={selectedPage} onValueChange={onPageChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleziona pagina" />
              </SelectTrigger>
              <SelectContent>
                {availablePages.map(page => (
                  <SelectItem key={page} value={page}>{page}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {pageClicks.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <p>Nessun dato di click per questa pagina</p>
            </div>
          ) : (
            <>
              {/* Heatmap Grid */}
              <div className="relative aspect-video border rounded-lg overflow-hidden bg-background mb-4">
                {/* Page representation */}
                <div className="absolute inset-0 p-2">
                  {/* Simulated page layout */}
                  <div className="w-full h-full relative">
                    {/* Header area */}
                    <div className="absolute top-0 left-0 right-0 h-[10%] border-b border-dashed border-muted-foreground/20 flex items-center px-4">
                      <span className="text-[10px] text-muted-foreground">Header / Nav</span>
                    </div>
                    {/* Hero area */}
                    <div className="absolute top-[10%] left-0 right-0 h-[30%] border-b border-dashed border-muted-foreground/20 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">Hero Section</span>
                    </div>
                    {/* Content area */}
                    <div className="absolute top-[40%] left-0 right-0 h-[40%] border-b border-dashed border-muted-foreground/20 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">Content</span>
                    </div>
                    {/* Footer area */}
                    <div className="absolute top-[80%] left-0 right-0 h-[20%] flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">Footer / CTA</span>
                    </div>
                  </div>
                </div>

                {/* Heatmap overlay */}
                <div 
                  className="absolute inset-0 grid gap-0.5 p-1"
                  style={{ 
                    gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
                  }}
                >
                  {heatmapGrid.map((row, rowIndex) =>
                    row.map((value, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`rounded-sm transition-colors ${getHeatColor(value)}`}
                        style={{ opacity: value > 0 ? 0.7 : 0.3 }}
                        title={`${value} click`}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-xs text-muted-foreground">Meno click</span>
                <div className="flex gap-0.5">
                  <div className="w-6 h-3 rounded-sm bg-blue-200 dark:bg-blue-900/50" />
                  <div className="w-6 h-3 rounded-sm bg-green-300 dark:bg-green-800/60" />
                  <div className="w-6 h-3 rounded-sm bg-yellow-300 dark:bg-yellow-700/70" />
                  <div className="w-6 h-3 rounded-sm bg-orange-400 dark:bg-orange-600/80" />
                  <div className="w-6 h-3 rounded-sm bg-red-500 dark:bg-red-500/90" />
                </div>
                <span className="text-xs text-muted-foreground">Più click</span>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
                <span>Totale click tracciati: <strong className="text-foreground">{pageClicks.length}</strong></span>
                <span>Max per cella: <strong className="text-foreground">{maxClicks}</strong></span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Top Clicked Elements */}
      {topElements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Elementi Più Cliccati</CardTitle>
            <CardDescription>Top 5 elementi per numero di click su {selectedPage}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topElements.map((element, index) => (
                <div key={element.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={index === 0 ? "default" : "outline"} 
                      className="w-6 h-6 flex items-center justify-center p-0"
                    >
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-md">{element.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(element.count / topElements[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{element.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
