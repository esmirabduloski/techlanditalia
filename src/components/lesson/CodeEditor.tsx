import { useRef, useCallback, KeyboardEvent } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: 'html' | 'css' | 'javascript';
  className?: string;
}

export function CodeEditor({ code, onChange, language, className = '' }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      if (e.shiftKey) {
        // Shift+Tab: remove indentation
        const beforeCursor = value.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const lineContent = value.substring(lineStart, start);
        
        // Check if line starts with spaces or tab
        if (lineContent.startsWith('  ')) {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + 2);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
          }, 0);
        } else if (lineContent.startsWith('\t')) {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + 1);
          onChange(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 1);
          }, 0);
        }
      } else {
        // Tab: add indentation (2 spaces)
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    // Handle Enter key for auto-indentation
    if (e.key === 'Enter') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const value = textarea.value;
      
      // Find current line's indentation
      const beforeCursor = value.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = value.substring(lineStart, start);
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      
      // Check if we should add extra indentation (after { or >)
      const charBefore = value[start - 1];
      let extraIndent = '';
      if (charBefore === '{' || charBefore === '>') {
        extraIndent = '  ';
      }
      
      const newValue = value.substring(0, start) + '\n' + indent + extraIndent + value.substring(start);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + extraIndent.length;
      }, 0);
    }

    // Handle closing brackets auto-indent
    if (e.key === '}' || e.key === ')' || e.key === ']') {
      const start = textarea.selectionStart;
      const value = textarea.value;
      const beforeCursor = value.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = value.substring(lineStart, start);
      
      // If line only has whitespace, reduce indentation
      if (/^\s+$/.test(currentLine) && currentLine.length >= 2) {
        e.preventDefault();
        const newValue = value.substring(0, lineStart) + currentLine.substring(2) + e.key + value.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start - 1;
        }, 0);
      }
    }
  }, [onChange]);

  // Map language names for prism
  const prismLanguage = language === 'javascript' ? 'jsx' : language;

  return (
    <div className={`relative h-full ${className}`}>
      {/* Syntax highlighted layer */}
      <Highlight theme={themes.vsDark} code={code} language={prismLanguage}>
        {({ className: highlightClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            ref={preRef}
            className={`${highlightClass} absolute inset-0 m-0 p-4 overflow-auto font-mono text-sm pointer-events-none`}
            style={{
              ...style,
              background: 'transparent',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>

      {/* Editable textarea overlay */}
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent text-transparent caret-white resize-none focus:outline-none"
        spellCheck={false}
        style={{
          caretColor: 'white',
          WebkitTextFillColor: 'transparent',
        }}
      />
    </div>
  );
}
