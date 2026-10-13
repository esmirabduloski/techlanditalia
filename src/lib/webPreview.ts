// Documento dell'anteprima Web: usato dal WebCompiler e dai casi di prova Web.

export interface WebPreviewInput {
  html: string;
  css: string;
  js: string;
  // Codice dei file JS allegati alla task (già scaricato)
  taskJs?: string;
  // File JS aggiuntivi creati dallo studente
  extraJs?: string;
  // URL di CSS/JS caricati dallo studente
  cssUrls?: string[];
  jsUrls?: string[];
  // Script aggiunto in fondo al body (es. quello dei casi di prova)
  tailScript?: string;
}

// Toglie doctype, html/head/body e i <link>: CSS e JS arrivano dalle schede dell'editor
export function stripDocumentTags(html: string): string {
  return html
    .replace(/<!DOCTYPE html>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '');
}

export function buildPreviewHtml({
  html, css, js, taskJs = '', extraJs = '', cssUrls = [], jsUrls = [], tailScript,
}: WebPreviewInput): string {
  const cssIncludes = cssUrls.map((url) => `<link rel="stylesheet" href="${url}">`).join('\n');
  const jsIncludes = jsUrls.map((url) => `<script src="${url}"></script>`).join('\n');

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${css}</style>
        ${cssIncludes}
      </head>
      <body>
        ${stripDocumentTags(html)}
        ${jsIncludes}
        <script>${taskJs}</script>
        <script>${js}</script>
        <script>${extraJs}</script>${tailScript ? `\n        <script>${tailScript}</script>` : ''}
      </body>
      </html>
    `;
}
