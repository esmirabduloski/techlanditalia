import { describe, expect, it } from 'vitest';
import { resolveCompiler } from './compilerKind';

describe('resolveCompiler', () => {
  const py = (python_env: string | null, default_python_code: string | null = null) => ({ python_env, default_python_code });

  it.each(['python-base', 'python-ai', 'python-avanzato'])('corso %s: Python standard di default', (slug) => {
    expect(resolveCompiler(slug, py(null))).toBe('python');
    expect(resolveCompiler(slug, py('standard', 'print(1)'))).toBe('python');
  });

  it('ambiente turtle e pgzero scelti dall\'admin', () => {
    expect(resolveCompiler('python-base', py('turtle'))).toBe('turtle');
    expect(resolveCompiler('python-base', py('pgzero', 'WIDTH = 400'))).toBe('pgzero');
  });

  it.each([
    'import turtle\nt = turtle.Turtle()',
    'from turtle import *\nforward(100)',
    '# disegno\n  import turtle',
    'import turtle as t',
  ])('Turtle quando il codice di partenza importa turtle: %j', (code) => {
    expect(resolveCompiler('python-base', py('standard', code))).toBe('turtle');
    expect(resolveCompiler('python-base', py(null, code))).toBe('turtle');
    // L'import di turtle vince anche su pgzero: Pyodide e Replit non hanno turtle
    expect(resolveCompiler('python-base', py('pgzero', code))).toBe('turtle');
  });

  it.each([
    '# import turtle\nprint(1)',
    'print("import turtle")',
    'x = 1  # from turtle',
  ])('un turtle commentato o in una stringa non conta: %j', (code) => {
    expect(resolveCompiler('python-base', py('standard', code))).toBe('python');
  });

  it('corso web: compilatore web, qualunque sia python_env', () => {
    expect(resolveCompiler('web-development', py(null))).toBe('web');
    expect(resolveCompiler('web-development', py('turtle', 'import turtle'))).toBe('web');
  });

  it('corsi senza compilatore', () => {
    expect(resolveCompiler('scratch-junior', py(null))).toBeNull();
    expect(resolveCompiler('', py('turtle'))).toBeNull();
    expect(resolveCompiler(null, py(null))).toBeNull();
    expect(resolveCompiler(undefined, py(null))).toBeNull();
  });
});
