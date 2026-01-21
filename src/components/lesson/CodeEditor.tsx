import { useRef, useCallback, KeyboardEvent, useMemo } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: 'html' | 'css' | 'javascript' | 'python';
  className?: string;
  placeholder?: string;
}

export function CodeEditor({ code, onChange, language, className = '', placeholder }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    return code.split('\n').length;
  }, [code]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
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
      
      // Check if we should add extra indentation (after { or > or :)
      const charBefore = value[start - 1];
      let extraIndent = '';
      if (charBefore === '{' || charBefore === '>' || charBefore === ':') {
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
    <div className={`relative h-full flex ${className}`}>
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 bg-[#1e1e1e] text-gray-500 text-right select-none overflow-hidden font-mono text-sm py-4 pr-3 pl-2 border-r border-gray-700"
        style={{ minWidth: '3rem' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i + 1} className="leading-[1.5]">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative overflow-hidden">
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
                lineHeight: '1.5',
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
          placeholder={placeholder}
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent text-transparent caret-white resize-none focus:outline-none"
          spellCheck={false}
          style={{
            caretColor: 'white',
            WebkitTextFillColor: 'transparent',
            lineHeight: '1.5',
          }}
        />
      </div>
    </div>
  );
}
