import { useRef, useCallback, KeyboardEvent, useMemo, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: 'html' | 'css' | 'javascript' | 'python';
  className?: string;
  placeholder?: string;
}

// Autocomplete suggestions per linguaggio
const AUTOCOMPLETE_SUGGESTIONS = {
  python: {
    'for': 'for i in range():\n    ',
    'while': 'while :\n    ',
    'if': 'if :\n    ',
    'def': 'def function():\n    ',
    'import': 'import ',
    'print': 'print()',
    'class': 'class ClassName:\n    ',
  },
  javascript: {
    'function': 'function() {\n  \n}',
    'const': 'const x = ',
    'let': 'let x = ',
    'if': 'if () {\n  \n}',
    'for': 'for (let i = 0; i < ; i++) {\n  \n}',
    'async': 'async function() {\n  \n}',
    'try': 'try {\n  \n} catch (e) {\n  \n}',
    'fetch': 'fetch(url).then(r => r.json()).then(d => )',
  },
  html: {
    'div': '<div></div>',
    'p': '<p></p>',
    'h1': '<h1></h1>',
    'a': '<a href=""></a>',
    'img': '<img src="" alt="">',
    'button': '<button></button>',
    'form': '<form>\n  \n</form>',
  },
  css: {
    'color': 'color: ;',
    'background': 'background-color: ;',
    'margin': 'margin: ;',
    'padding': 'padding: ;',
    'display': 'display: flex;',
    'font-size': 'font-size: px;',
    'border': 'border: 1px solid #000;',
  },
};

export function CodeEditor({ code, onChange, language, className = '', placeholder }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });

  const lineCount = useMemo(() => {
    return code.split('\n').length;
  }, [code]);

  // Error detection for Python
  const pythonErrors = useMemo(() => {
    if (language !== 'python') return [];
    const errors: Array<{ line: number; type: string; msg: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, idx) => {
      if (line.match(/^[^\s]/) && idx > 0 && lines[idx-1].endsWith(':')) {
        errors.push({ line: idx, type: 'indent', msg: 'Indentazione attesa dopo :' });
      }
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({ line: idx, type: 'syntax', msg: 'Parentesi non chiuse' });
      }
    });
    
    return errors;
  }, [code, language]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const insertAutocomplete = useCallback((suggestion: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const value = textarea.value;
    const beforeCursor = value.substring(0, start);
    const wordMatch = beforeCursor.match(/\w+$/);
    
    if (wordMatch) {
      const wordStart = start - wordMatch[0].length;
      const snippets = AUTOCOMPLETE_SUGGESTIONS[language as keyof typeof AUTOCOMPLETE_SUGGESTIONS] || {};
      const fullSnippet = (snippets as Record<string, string>)[suggestion] || suggestion;
      
      const newValue = value.substring(0, wordStart) + fullSnippet + value.substring(start);
      onChange(newValue);
      
      setShowAutocomplete(false);
      setTimeout(() => {
        const cursorPos = wordStart + fullSnippet.length;
        textarea.selectionStart = textarea.selectionEnd = cursorPos;
      }, 0);
    }
  }, [language, onChange]);

  const handleInputChange = useCallback((newCode: string) => {
    onChange(newCode);
    
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const beforeCursor = newCode.substring(0, start);
      const wordMatch = beforeCursor.match(/\b(\w{2,})$/);
      
      if (wordMatch) {
        const suggestions = Object.keys(
          AUTOCOMPLETE_SUGGESTIONS[language as keyof typeof AUTOCOMPLETE_SUGGESTIONS] || {}
        ).filter(s => s.startsWith(wordMatch[1].toLowerCase()));
        
        if (suggestions.length > 0) {
          setFilteredSuggestions(suggestions);
          setAutocompleteIndex(0);
          setShowAutocomplete(true);
          
          const lines = beforeCursor.split('\n');
          const lineIndex = lines.length - 1;
          const columnIndex = lines[lineIndex].length;
          setAutocompletePos({
            top: lineIndex * 24,
            left: columnIndex * 8,
          });
        } else {
          setShowAutocomplete(false);
        }
      } else {
        setShowAutocomplete(false);
      }
    }
  }, [language, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertAutocomplete(filteredSuggestions[autocompleteIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }

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
      
      const beforeCursor = value.substring(0, start);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = value.substring(lineStart, start);
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      
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
      
      if (/^\s+$/.test(currentLine) && currentLine.length >= 2) {
        e.preventDefault();
        const newValue = value.substring(0, lineStart) + currentLine.substring(2) + e.key + value.substring(start);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start - 1;
        }, 0);
      }
    }
  }, [onChange, showAutocomplete, autocompleteIndex, filteredSuggestions, insertAutocomplete]);

  // Map language names for prism
  const prismLanguage = language === 'javascript' ? 'jsx' : language;

  return (
    <div className={`relative h-full flex ${className}`}>
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 bg-[#1e1e1e] text-muted-foreground text-right select-none overflow-hidden font-mono text-sm py-4 pr-3 pl-2 border-r border-border"
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

        {/* Error indicators */}
        {pythonErrors.length > 0 && (
          <div className="absolute inset-0 pointer-events-none p-4">
            {pythonErrors.map((err, i) => (
              <div
                key={i}
                className="absolute w-full h-6 border-l-2 border-destructive bg-destructive/10"
                style={{ top: `${err.line * 24 + 16}px` }}
              />
            ))}
          </div>
        )}

        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredSuggestions.length > 0 && (
          <div
            className="absolute bg-muted border border-border rounded shadow-lg z-10"
            style={{
              top: `${autocompletePos.top + 32}px`,
              left: `${autocompletePos.left}px`,
              minWidth: '200px',
            }}
          >
            {filteredSuggestions.map((suggestion, idx) => (
              <div
                key={suggestion}
                onClick={() => insertAutocomplete(suggestion)}
                className={`px-3 py-1.5 text-sm cursor-pointer font-mono ${
                  idx === autocompleteIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'
                }`}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}

        {/* Editable textarea overlay */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => handleInputChange(e.target.value)}
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
