# Welcome to your Lovable project

## Build & Prerendering (SEO)

Il sito usa [vite-react-ssg](https://github.com/Daydreamer-riri/vite-react-ssg) per generare **HTML statico delle pagine marketing pubbliche** a build-time (home, /corsi, pagine corso, /blog e articoli, /faq, ecc.), mantenendo il comportamento SPA per le aree private (`/admin`, `/area-riservata`, `/insegnante`, `/auth`) e per le landing `/lp/` (escluse di proposito: sono noindex).

```sh
npm run dev               # dev server classico (SPA, nessun prerender)
npm run build             # build di produzione CON prerendering (vite-react-ssg build)
npm run verify:prerender  # smoke-check su dist/: title, canonical, description, schema JSON-LD
npm run build:spa         # fallback di emergenza: build SPA pura senza prerender (vite build)
npm run preview           # serve dist/ in locale
```

Punti chiave dell'architettura:

- **Route**: definite come array data-router in `src/routes.tsx` (non più JSX `<Routes>`). `src/App.tsx` è il layout root con i provider; `src/main.tsx` esporta `createRoot` via `ViteReactSSG`.
- **Head/meta**: gestiti da `SEOHead` (`src/components/seo/SEOHead.tsx`) con il componente `Head` di vite-react-ssg. `index.html` non contiene più meta duplicati: ogni pagina prerenderata emette i propri title/description/canonical/og/schema.
- **Perimetro prerender**: whitelist/esclusioni in `vite.config.ts` (`ssgOptions.includedRoutes` + `NO_PRERENDER_PREFIXES`). Gli slug corso prerenderati sono in `src/routes.tsx` (`PRERENDERED_COURSE_SLUGS`).
- **Blog**: gli slug pubblicati vengono letti da Supabase a build-time (`getStaticPaths`) e il contenuto è caricato dal `loader` di `src/pages/BlogArticle.tsx`. Gli articoli pubblicati **dopo** l'ultima build funzionano comunque (fallback client-side), ma ottengono l'HTML statico solo alla build successiva → **rilanciare la build a ogni pubblicazione** (o schedulare una build quotidiana).
- **Regole SSR-safety**: niente `window`/`document`/`localStorage` a render-time nei componenti delle pagine pubbliche (solo dentro `useEffect`/handler). Per widget browser-only usare `<ClientOnly>` di vite-react-ssg. La build usa `ssgOptions.mock: true` per il client Supabase auto-generato.
- **SEOHead sempre fuori dagli early-return di loading**: l'HTML statico cattura lo stato iniziale della pagina; se l'head è renderizzato solo dopo un fetch, la pagina prerenderata resta senza meta (vedi `Corsi.tsx` / `LavoraConNoiGuard.tsx`).
- **Rollback**: `npm run build:spa` ripristina l'output SPA identico al pre-migrazione senza toccare il codice.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
