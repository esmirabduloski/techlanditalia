import { Highlight, themes } from 'prism-react-renderer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeViewerProps {
  code: string;
  language?: string;
  fileName?: string;
}

const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'js':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'lua':
      return 'lua';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
};

export function CodeViewer({ code, language, fileName }: CodeViewerProps) {
  const detectedLanguage = language || (fileName ? getLanguageFromFileName(fileName) : 'plaintext');

  return (
    <div className="rounded-lg border bg-[#1e1e1e] overflow-hidden">
      {fileName && (
        <div className="px-4 py-2 bg-muted/10 border-b border-border/50 text-xs text-muted-foreground font-mono">
          {fileName}
        </div>
      )}
      <ScrollArea className="max-h-[400px]">
        <Highlight theme={themes.vsDark} code={code.trim()} language={detectedLanguage as any}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={`${className} p-4 text-sm overflow-x-auto`} style={style}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell pr-4 text-muted-foreground/50 text-right select-none w-8">
                    {i + 1}
                  </span>
                  <span className="table-cell">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </ScrollArea>
    </div>
  );
}
