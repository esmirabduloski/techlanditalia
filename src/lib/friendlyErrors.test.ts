import { describe, expect, it } from 'vitest';
import { closestName, explainPythonError } from './friendlyErrors';

const PYODIDE_TRACEBACK = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
    await CodeRunner(
  File "/lib/python311.zip/_pyodide/_base.py", line 394, in run_async
    coroutine = eval(self.code, globals, locals)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "<exec>", line 2, in <module>
NameError: name 'punteggio' is not defined`;

describe('explainPythonError', () => {
  it('spiega un NameError di Pyodide con la riga', () => {
    const e = explainPythonError(PYODIDE_TRACEBACK, 'x = 1\nprint(punteggio)\n');
    expect(e).toMatchObject({ type: 'NameError', line: 2, original: "NameError: name 'punteggio' is not defined" });
    expect(e?.explanation).toContain('`punteggio`');
    expect(e?.explanation).toContain('non sa ancora');
  });

  it('suggerisce il nome giusto (maiuscole e errori di battitura)', () => {
    expect(explainPythonError("NameError: name 'Print' is not defined (riga 1)")?.tip).toContain('`print`');
    expect(explainPythonError("NameError: name 'pritn' is not defined")?.tip).toContain('`print`');
    expect(explainPythonError("NameError: name 'punti' is not defined", 'punteggio = 0\nprint(punti)')?.tip).toBeTruthy();
    expect(explainPythonError("NameError: name 'gatto' is not defined")?.tip).toContain('"gatto"');
  });

  it('la riga è quella dell\'alunno anche se l\'errore nasce nel codice di servizio (<techland>)', () => {
    const annullato = `Traceback (most recent call last):
  File "/lib/python311.zip/_pyodide/_base.py", line 571, in eval_code_async
  File "<exec>", line 2, in <module>
  File "<techland>", line 16, in _js_input
KeyboardInterrupt: Input annullato dall'utente`;
    expect(explainPythonError(annullato, 'print(1)\nx = input()\n')).toMatchObject({ type: 'KeyboardInterrupt', line: 2 });
  });

  it('Pygame Zero: immagine o suono che non c\'è tra i file del gioco', () => {
    const immagine = `  File "<exec>", line 4, in <module>\nKeyError: "No image found like 'alien'. Are you sure the image exists?"`;
    expect(explainPythonError(immagine)).toMatchObject({ type: 'KeyError', line: 4, title: 'Immagine non trovata' });
    expect(explainPythonError(immagine)?.explanation).toContain('`alien`');
    expect(explainPythonError(`KeyError: "No sound found like 'salto'. Are you sure the sound exists?"`)?.title).toBe('Suono non trovato');
    expect(explainPythonError(`KeyError: "No 'music' directory found to load music 'tema'."`)?.title).toBe('Musica non trovata');
    expect(explainPythonError("KeyError: 'Sara'")?.title).toBe('Chiave non trovata');
  });

  it('legge la riga dal worker e da Skulpt', () => {
    expect(explainPythonError('ZeroDivisionError: division by zero (riga 4)')).toMatchObject({ type: 'ZeroDivisionError', line: 4, original: 'ZeroDivisionError: division by zero' });
    expect(explainPythonError("NameError: name 'x' is not defined on line 3")).toMatchObject({ type: 'NameError', line: 3 });
  });

  it('spiega gli errori di sintassi più comuni', () => {
    const syntax = `  File "<exec>", line 1\n    print("ciao"\n         ^\nSyntaxError: '(' was never closed`;
    expect(explainPythonError(syntax)).toMatchObject({ type: 'SyntaxError', line: 1 });
    expect(explainPythonError(syntax)?.explanation).toContain('parentesi');
    expect(explainPythonError('SyntaxError: expected \':\'')?.explanation).toContain('due punti');
    expect(explainPythonError('SyntaxError: unterminated string literal (detected at line 1)')?.explanation).toContain('virgolette');
    expect(explainPythonError("SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?")?.tip).toContain('==');
    expect(explainPythonError("SyntaxError: invalid character '“' (U+201C)")?.tip).toContain('dritte');
    expect(explainPythonError('SyntaxError: bad input on line 2')).toMatchObject({ line: 2 });
  });

  it('spiega indentazione e tipi', () => {
    expect(explainPythonError("IndentationError: expected an indented block after 'if' statement on line 1")?.explanation).toContain('`if`');
    expect(explainPythonError('TypeError: can only concatenate str (not "int") to str')?.tip).toContain('str(');
    expect(explainPythonError("TypeError: unsupported operand type(s) for +: 'int' and 'str'")?.tip).toContain('int(input())');
    expect(explainPythonError("TypeError: somma() missing 1 required positional argument: 'b'")?.explanation).toContain('`somma()`');
    expect(explainPythonError("ValueError: invalid literal for int() with base 10: 'ciao'")?.title).toBe('Questo testo non è un numero');
    expect(explainPythonError('IndexError: list index out of range')?.tip).toContain('0');
  });

  it('suggerisce il comando giusto per un AttributeError', () => {
    const e = explainPythonError("AttributeError: 'Turtle' object has no attribute 'foward'");
    expect(e?.tip).toContain('`forward`');
  });

  it('restituisce null per messaggi già in italiano o vuoti', () => {
    expect(explainPythonError('Il risultato non è quello atteso')).toBeNull();
    expect(explainPythonError('Tempo scaduto (ciclo infinito?)')).toBeNull();
    expect(explainPythonError('Error: Esecuzione interrotta')).toBeNull();
    expect(explainPythonError('')).toBeNull();
  });

  it('dà comunque una spiegazione generica per errori sconosciuti', () => {
    expect(explainPythonError('StrangeError: boh')).toMatchObject({ type: 'StrangeError', title: "C'è un errore nel programma" });
  });
});

describe('closestName', () => {
  it('non suggerisce nomi troppo diversi', () => {
    expect(closestName('xyzzy')).toBeNull();
    expect(closestName('inptu')).toBe('input');
  });
});
