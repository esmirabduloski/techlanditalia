import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, ExternalLink, Loader2, Maximize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PgzeroCompilerProps {
  defaultCode?: string;
}

const FALLBACK_CODE = `# Pygame Zero - Gioco semplice
# Questo codice funziona con Pygame Zero (pgzrun)

WIDTH = 400
HEIGHT = 300

# Variabili di gioco
player_x = 200
player_y = 150
speed = 5

def draw():
    screen.fill("darkblue")
    screen.draw.filled_circle((player_x, player_y), 20, "yellow")
    screen.draw.text("Usa le frecce per muoverti!", (50, 20), fontsize=20, color="white")

def update():
    global player_x, player_y
    
    if keyboard.left and player_x > 20:
        player_x -= speed
    if keyboard.right and player_x < WIDTH - 20:
        player_x += speed
    if keyboard.up and player_y > 20:
        player_y -= speed
    if keyboard.down and player_y < HEIGHT - 20:
        player_y += speed

# Per eseguire: pgzrun nome_file.py`;

export function PgzeroCompiler({ defaultCode }: PgzeroCompilerProps) {
  const [code, setCode] = useState(defaultCode || FALLBACK_CODE);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runCode = () => {
    setIsLoading(true);
    // Open the dialog to show the game
    setTimeout(() => {
      setIsDialogOpen(true);
      setIsLoading(false);
    }, 100);
  };

  const resetCode = () => {
    setCode(defaultCode || FALLBACK_CODE);
    toast({
      title: 'Codice ripristinato',
      description: 'Il codice è stato riportato alla versione iniziale.',
    });
  };

  const openInReplit = () => {
    // Open Replit Pygame Zero template in a new tab
    window.open('https://replit.com/new/pygame', '_blank');
  };

  // Create a Replit embed URL with the code
  // Note: Replit's embed doesn't support code injection, so we use their pygame template
  const getReplitEmbedUrl = () => {
    // We can use a public pygame-zero focused repl template
    return 'https://replit.com/@templates/Pygame?embed=true';
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold flex items-center gap-2">
          🎮 Python Pygame Zero
        </h3>
        <p className="text-sm text-muted-foreground">
          Scrivi giochi con Pygame Zero! Clicca Esegui per aprire l'ambiente di gioco.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🎮 Pygame Zero</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCode}
            title="Resetta codice"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={openInReplit}
            title="Apri in Replit"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={runCode}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Esegui Gioco
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
            placeholder="Scrivi il tuo codice Pygame Zero..."
            spellCheck={false}
          />
        </div>

        {/* Instructions */}
        <div className="border-t border-border bg-muted/30 p-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">📝 Come usare Pygame Zero:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Scrivi il tuo codice qui sopra</li>
              <li>Clicca "Esegui Gioco" per aprire l'ambiente di esecuzione</li>
              <li>Copia il codice nell'editor Replit e premi Run</li>
            </ol>
            <p className="text-xs mt-3 text-muted-foreground/80">
              💡 Pygame Zero richiede un ambiente con finestra grafica. Usa Replit per eseguire i giochi!
            </p>
          </div>
        </div>
      </div>

      {/* Game Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎮 Pygame Zero - Ambiente di Esecuzione
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Il tuo codice è pronto! Per eseguirlo:
              </p>
              <ol className="list-decimal list-inside text-sm space-y-1">
                <li>Copia il codice qui sotto</li>
                <li>Incollalo nell'editor Replit qui accanto</li>
                <li>Clicca il pulsante "Run" verde</li>
              </ol>
            </div>
            
            {/* Code display */}
            <div className="flex-1 flex gap-4">
              <div className="w-1/2">
                <p className="text-sm font-medium mb-2">Il tuo codice:</p>
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto h-[200px] whitespace-pre-wrap">
                  {code}
                </pre>
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(code);
                    toast({
                      title: 'Codice copiato!',
                      description: 'Ora incollalo nell\'editor Replit.',
                    });
                  }}
                >
                  📋 Copia Codice
                </Button>
              </div>
              
              <div className="w-1/2">
                <p className="text-sm font-medium mb-2">Editor Replit:</p>
                <iframe
                  src="https://replit.com/@replit/Pygame?embed=true"
                  className="w-full h-[250px] rounded-lg border"
                  title="Replit Pygame"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
                <Button
                  className="mt-2 w-full"
                  variant="default"
                  onClick={openInReplit}
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Apri in Replit (schermo intero)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
