import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, ExternalLink } from 'lucide-react';
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
  const [key, setKey] = useState(0);
  const { toast } = useToast();

  const code = defaultCode || FALLBACK_CODE;

  // Generate the Trinket embed URL with the code pre-loaded
  const trinketUrl = useMemo(() => {
    const encodedCode = encodeURIComponent(code);
    return `https://trinket.io/tools/1.0/jekyll/embed/python#code=${encodedCode}`;
  }, [code, key]);

  const resetCode = () => {
    // Force iframe reload by changing key
    setKey(prev => prev + 1);
    toast({
      title: 'Compilatore ricaricato',
      description: 'Il compilatore Turtle è stato ricaricato con il codice originale.',
    });
  };

  const openInTrinket = () => {
    window.open('https://trinket.io/python/new', '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            🐢 Python Turtle
          </h3>
          <p className="text-sm text-muted-foreground">
            Modifica il codice e clicca ▶ Run per eseguire
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCode}
            title="Ricarica compilatore"
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
        </div>
      </div>

      {/* Full Trinket Embed - Code editor + output in one */}
      <div className="flex-1 min-h-0">
        <iframe
          key={key}
          src={trinketUrl}
          className="w-full h-full"
          title="Python Turtle Compiler"
          frameBorder="0"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
