import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PgzeroCompilerProps {
  defaultCode?: string;
}

const FALLBACK_CODE = `# Pygame Zero - Gioco semplice
# Copia questo codice in main.py nell'editor Replit

WIDTH = 400
HEIGHT = 300

player_x = 200
player_y = 150
speed = 5

def draw():
    screen.fill("darkblue")
    screen.draw.filled_circle((player_x, player_y), 20, "yellow")
    screen.draw.text("Usa le frecce!", (50, 20), fontsize=20, color="white")

def update():
    global player_x, player_y
    
    if keyboard.left and player_x > 20:
        player_x -= speed
    if keyboard.right and player_x < WIDTH - 20:
        player_x += speed
    if keyboard.up and player_y > 20:
        player_y -= speed
    if keyboard.down and player_y < HEIGHT - 20:
        player_y += speed`;

export function PgzeroCompiler({ defaultCode }: PgzeroCompilerProps) {
  const code = defaultCode || FALLBACK_CODE;
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: '✅ Codice copiato!',
        description: 'Ora apri Replit e incollalo in main.py',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Errore',
        description: 'Non è stato possibile copiare il codice.',
        variant: 'destructive',
      });
    }
  };

  const openInReplit = () => {
    window.open('https://replit.com/@esmir1475/Pygame', '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header with instructions */}
      <div className="px-4 py-4 border-b bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2 text-foreground text-lg">
            🎮 Pygame Zero
          </h3>
        </div>
        
        {/* Main instruction */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
          <p className="text-sm font-medium text-foreground">
            📋 <strong>COPIA</strong> questo codice con il bottone qui sotto, poi <strong>INCOLLALO in REPLIT</strong> nel file <code className="bg-muted px-1.5 py-0.5 rounded text-xs">main.py</code>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant={copied ? "default" : "outline"}
            onClick={copyCode}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiato!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copia Codice
              </>
            )}
          </Button>
          <Button
            onClick={openInReplit}
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Apri Replit
          </Button>
        </div>
      </div>

      {/* Code display */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap bg-muted/30">
          {code}
        </pre>
      </div>

      {/* Footer instruction */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Istruzioni:</strong> 1) Copia il codice → 2) Clicca "Apri Replit" → 3) Incolla in <code className="bg-muted px-1 rounded">main.py</code> → 4) Clicca <strong>Run</strong>
        </p>
      </div>
    </div>
  );
}
