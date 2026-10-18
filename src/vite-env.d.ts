/// <reference types="vite/client" />

// Dati dei corsi dal DB a build-time (plugin techland:course-facts in vite.config.ts)
declare module "virtual:course-facts" {
  const courses: import("./lib/courseFacts").CourseFactsMap;
  export default courses;
}

// Iubenda Cookie Solution (caricato in index.html)
interface Window {
  _iub?: { cs?: { api?: { openPreferences?: () => void } } };
}
