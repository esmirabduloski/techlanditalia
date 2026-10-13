import { describe, expect, it } from 'vitest';
import { buildPreviewHtml, stripDocumentTags } from './webPreview';

describe('stripDocumentTags', () => {
  it('toglie doctype, html/head/body e link', () => {
    const html = '<!DOCTYPE html>\n<html lang="it"><head><link rel="stylesheet" href="style.css"></head><body class="x"><h1>Ciao</h1></body></html>';
    expect(stripDocumentTags(html).replace(/\s+/g, '')).toBe('<h1>Ciao</h1>');
  });
});

describe('buildPreviewHtml', () => {
  it('unisce CSS, HTML, file caricati e JS nell\'ordine dell\'anteprima', () => {
    const doc = buildPreviewHtml({
      html: '<body><p>x</p></body>',
      css: 'p{color:red}',
      js: 'console.log(1)',
      taskJs: 'var task=1',
      extraJs: 'var extra=1',
      cssUrls: ['https://a/s.css'],
      jsUrls: ['https://a/s.js'],
    });
    const order = ['<style>p{color:red}</style>', 'href="https://a/s.css"', '<p>x</p>', 'src="https://a/s.js"', 'var task=1', 'console.log(1)', 'var extra=1'];
    const positions = order.map((s) => doc.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(doc).not.toContain('<body><p>');
  });

  it('aggiunge lo script finale solo se richiesto', () => {
    expect(buildPreviewHtml({ html: '', css: '', js: '' })).not.toContain('tail()');
    expect(buildPreviewHtml({ html: '', css: '', js: '', tailScript: 'tail()' })).toContain('<script>tail()</script>');
  });
});
