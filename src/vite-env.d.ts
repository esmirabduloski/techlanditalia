/// <reference types="vite/client" />

// Iubenda Cookie Solution (caricato in index.html)
interface Window {
  _iub?: { cs?: { api?: { openPreferences?: () => void } } };
}
