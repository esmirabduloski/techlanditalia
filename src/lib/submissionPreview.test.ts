import { describe, expect, it } from 'vitest';
import {
  filePreviewKind,
  reviewCompiler,
  scratchEmbedUrl,
  scratchProjectId,
  splitWebCode,
  turbowarpEmbedUrl,
} from './submissionPreview';

describe('filePreviewKind', () => {
  it('riconosce i formati dall’estensione', () => {
    expect(filePreviewKind('foto.JPG')).toBe('image');
    expect(filePreviewKind('relazione.pdf')).toBe('pdf');
    expect(filePreviewKind('gioco.sb3')).toBe('scratch');
    expect(filePreviewKind('main.py')).toBe('python');
    expect(filePreviewKind('index.htm')).toBe('html');
    expect(filePreviewKind('script.js')).toBe('code');
    expect(filePreviewKind('video.mp4')).toBe('video');
    expect(filePreviewKind('voce.wav')).toBe('audio');
    expect(filePreviewKind('mondo.rbxl')).toBe('other');
  });

  it('usa il tipo MIME se manca l’estensione', () => {
    expect(filePreviewKind('scansione', 'image/png')).toBe('image');
    expect(filePreviewKind(null, 'application/pdf')).toBe('pdf');
  });
});

describe('scratchProjectId', () => {
  it('trova il progetto nei link Scratch e TurboWarp', () => {
    expect(scratchProjectId('Ecco il mio gioco: https://scratch.mit.edu/projects/123456/')).toBe('123456');
    expect(scratchProjectId('https://scratch.mit.edu/projects/987/editor')).toBe('987');
    expect(scratchProjectId('https://turbowarp.org/555?fps=60')).toBe('555');
    expect(scratchProjectId('nessun link')).toBeNull();
    expect(scratchProjectId(null)).toBeNull();
  });

  it('crea gli indirizzi dei player', () => {
    expect(scratchEmbedUrl('42')).toBe('https://scratch.mit.edu/projects/42/embed');
    expect(turbowarpEmbedUrl('https://x.supabase.co/a.sb3?token=a&b=1')).toBe(
      'https://turbowarp.org/embed?project_url=https%3A%2F%2Fx.supabase.co%2Fa.sb3%3Ftoken%3Da%26b%3D1',
    );
  });
});

describe('splitWebCode', () => {
  it('divide la consegna del compilatore Web', () => {
    const code = '<!-- HTML -->\n<h1>Ciao</h1>\n\n/* CSS */\nh1 { color: red; }\n\n// JavaScript\nconsole.log(1);';
    expect(splitWebCode(code)).toEqual({ html: '<h1>Ciao</h1>', css: 'h1 { color: red; }', js: 'console.log(1);' });
  });

  it('non tocca il codice Python', () => {
    expect(splitWebCode('print("ciao")')).toBeNull();
  });
});

describe('reviewCompiler', () => {
  it('riapre lo stesso compilatore del compito', () => {
    expect(reviewCompiler('python-base', { python_env: 'pgzero' }, 'WIDTH = 400')).toBe('pgzero');
    expect(reviewCompiler('python-base', { python_env: 'turtle' }, 'print(1)')).toBe('turtle');
    expect(reviewCompiler('python-base', {}, 'print(1)')).toBe('python');
    expect(reviewCompiler('web-development', {}, '<!-- HTML -->\n<p></p>')).toBe('web');
  });

  it('deduce turtle o pgzero dal codice se il corso non lo dice', () => {
    expect(reviewCompiler(null, {}, 'import turtle\nturtle.forward(10)')).toBe('turtle');
    expect(reviewCompiler('scratch', {}, 'import pgzrun\npgzrun.go()')).toBe('pgzero');
  });
});
