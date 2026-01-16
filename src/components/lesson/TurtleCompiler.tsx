import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TurtleCompilerProps {
  defaultCode?: string;
}

const FALLBACK_CODE = `import turtle

# Crea la finestra
screen = turtle.Screen()
screen.bgcolor("white")

# Crea la tartaruga
t = turtle.Turtle()
t.color("blue")
t.pensize(2)

# Disegna un quadrato
for _ in range(4):
    t.forward(100)
    t.right(90)

turtle.done()`;

export function TurtleCompiler({ defaultCode }: TurtleCompilerProps) {
  const [code, setCode] = useState(defaultCode || FALLBACK_CODE);
  const [trinketUrl, setTrinketUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateTrinketUrl = () => {
    // Trinket allows embedding Python code via URL parameters
    // We use the turtle template
    const encodedCode = encodeURIComponent(code);
    return `https://trinket.io/tools/1.0/jekyll/embed/python#code=${encodedCode}`;
  };

  const runCode = () => {
    setIsLoading(true);
    // Generate new URL with current code
    const url = generateTrinketUrl();
    setTrinketUrl(null);
    // Small delay to force iframe reload
    setTimeout(() => {
      setTrinketUrl(url);
      setIsLoading(false);
    }, 100);
  };

  const resetCode = () => {
    setCode(defaultCode || FALLBACK_CODE);
    setTrinketUrl(null);
    toast({
      title: 'Codice ripristinato',
      description: 'Il codice è stato riportato alla versione iniziale.',
    });
  };

  const openInTrinket = () => {
    // Open Trinket in a new tab with the code
    window.open('https://trinket.io/python/new', '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold flex items-center gap-2">
          🐢 Python Turtle
        </h3>
        <p className="text-sm text-muted-foreground">
          Scrivi il codice e clicca Esegui per vedere la grafica turtle!
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🐢 Turtle Graphics</span>
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
            onClick={openInTrinket}
            title="Apri in Trinket"
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
            Esegui
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="h-1/2 min-h-[200px] border-b">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
            placeholder="Scrivi il tuo codice Python con turtle..."
            spellCheck={false}
          />
        </div>

        {/* Output / Preview */}
        <div className="h-1/2 min-h-[250px] bg-muted/30">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">Output Grafico</span>
          </div>
          <div className="h-[calc(100%-32px)] p-2">
            {trinketUrl ? (
              <iframe
                src={trinketUrl}
                className="w-full h-full rounded-lg border bg-white"
                title="Turtle Output"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground rounded-lg border bg-muted/20">
                <div className="text-center">
                  <p className="text-lg mb-2">🐢</p>
                  <p>Clicca "Esegui" per vedere il risultato</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
