import { useTheme } from 'next-themes';
import { LIGHT_COLORS, DARK_COLORS } from '@/hooks/useBackgroundColor';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette } from 'lucide-react';

interface BackgroundColorPickerProps {
  currentColor: string | null;
  onColorChange: (color: string | null) => void;
}

export function BackgroundColorPicker({ currentColor, onColorChange }: BackgroundColorPickerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Colore Sfondo
        </CardTitle>
        <CardDescription className="text-xs">
          Personalizza il colore della tua dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 flex-wrap">
          {colors.map((color) => (
            <button
              key={color.id}
              onClick={() => onColorChange(color.id)}
              className="relative w-9 h-9 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50"
              style={{
                backgroundColor: color.value,
                borderColor: currentColor === color.id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                boxShadow: currentColor === color.id ? '0 0 0 2px hsl(var(--primary) / 0.3)' : 'none',
              }}
              title={color.label}
            >
              {currentColor === color.id && (
                <Check className="w-4 h-4 absolute inset-0 m-auto" style={{ color: isDark ? '#ccc' : '#555' }} />
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9"
            onClick={() => onColorChange(null)}
            title="Ripristina default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
