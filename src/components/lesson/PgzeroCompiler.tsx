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
        description: 'Incollalo in main.py nell\'editor Replit a destra.',
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
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2 text-foreground">
              🎮 Pygame Zero
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copia il codice → Incollalo in main.py → Clicca Run
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openInReplit}
            className="gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Apri in Replit
          </Button>
        </div>
      </div>

      {/* Main content - Split view */}
      <div className="flex-1 flex min-h-0">
        {/* Code Panel */}
        <div className="w-2/5 flex flex-col border-r border-border">
          <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">📝 Il tuo codice</span>
            <Button
              variant={copied ? "default" : "ghost"}
              size="sm"
              onClick={copyCode}
              className="gap-1.5 h-7"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiato!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copia
                </>
              )}
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <pre className="p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
              {code}
            </pre>
          </div>
          <div className="px-3 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Istruzioni:</strong> Copia questo codice, incollalo nel file <code className="bg-muted px-1 rounded">main.py</code> dell'editor Replit, poi clicca il pulsante verde <strong>Run</strong>.
            </p>
          </div>
        </div>

        {/* Replit Embed */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/50">
            <span className="text-sm font-medium">🚀 Editor Replit</span>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              src="https://replit.com/@esmir1475/Pygame?embed=true"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              title="Pygame Zero - Replit"
              className="bg-background"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
