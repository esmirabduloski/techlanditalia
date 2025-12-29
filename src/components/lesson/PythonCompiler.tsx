import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<any>;
  }
}

export function PythonCompiler() {
  const [code, setCode] = useState<string>('# Scrivi il tuo codice Python qui\nprint("Ciao, mondo!")\n');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const pyodideRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPyodide();
  }, []);

  const loadPyodide = async () => {
    try {
      // Load Pyodide script if not already loaded
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide'));
        });
      }

      // Initialize Pyodide
      pyodideRef.current = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
      });

      setIsLoading(false);
      setOutput('Python pronto! Clicca "Esegui" per eseguire il codice.');
    } catch (error) {
      console.error('Error loading Pyodide:', error);
      setOutput('Errore nel caricamento di Python. Ricarica la pagina.');
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile caricare Python',
      });
    }
  };

  const runCode = async () => {
    if (!pyodideRef.current || isRunning) return;

    setIsRunning(true);
    setOutput('Esecuzione in corso...');

    try {
      // Redirect stdout to capture print statements
      pyodideRef.current.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      // Run user code
      await pyodideRef.current.runPythonAsync(code);

      // Get stdout output
      const stdout = pyodideRef.current.runPython('sys.stdout.getvalue()');
      const stderr = pyodideRef.current.runPython('sys.stderr.getvalue()');

      if (stderr) {
        setOutput(`Output:\n${stdout}\n\nErrori:\n${stderr}`);
      } else {
        setOutput(stdout || '(Nessun output)');
      }
    } catch (error: any) {
      setOutput(`Errore:\n${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput('');
  };

  const resetCode = () => {
    setCode('# Scrivi il tuo codice Python qui\nprint("Ciao, mondo!")\n');
    setOutput('');
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🐍 Python</span>
          {isLoading && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Caricamento...
            </span>
          )}
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
            onClick={clearOutput}
            title="Pulisci output"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={runCode}
            disabled={isLoading || isRunning}
          >
            {isRunning ? (
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
        <div className="flex-1 min-h-0">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
            placeholder="Scrivi il tuo codice Python..."
            spellCheck={false}
          />
        </div>

        {/* Output */}
        <div className="h-1/3 min-h-[120px] border-t border-border bg-muted/30">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">Output</span>
          </div>
          <pre className="p-4 text-sm font-mono overflow-auto h-[calc(100%-32px)] text-foreground whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}
