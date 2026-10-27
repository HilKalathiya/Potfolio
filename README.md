# hil.agent

Portfolio site for **Hil Kalathiya**, AI engineer. Every system he built is drawn as the agent
graph it runs on (Three.js), with click-to-inspect parts, and four agents (planner, scout,
verifier, scribe) work across the page. Dark and light mode, phone layout, one-page résumé
download (no phone number), and a contact form that lands in his private inbox.

Static site built with [Vite](https://vite.dev). Three.js is bundled from npm; Lenis is self-hosted.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # outputs dist/
npm run preview   # serve dist/
```

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole page: markup, styles, the page layer and the 3D graph scene |
| `src/form.js`, `src/form.css` | "Leave Hil a message" form |
| `inbox.html`, `src/contact/inbox.js` | Hil's private inbox (`/inbox`) |
| `public/` | Résumé PDF (no phone number), résumé preview, Lenis, favicon, OG image |

## Contact form

The form POSTs JSON `{ name, email, message, website, elapsed_ms, page }` to
`VITE_CONTACT_ENDPOINT` (a Supabase RPC). `website` is a honeypot. When `VITE_CONTACT_KEY`
is set it is sent as the `apikey` header (it is the public publishable key).
If no endpoint is configured, the form opens Gmail compose with the message filled in, and on
any error it offers that link as a fallback.

Copy `.env.example` to `.env` locally, or set the same variables in the hosting dashboard.

The email address everywhere links to Gmail compose
(`https://mail.google.com/mail/?view=cm&to=…`), with a `mailto:` "Other mail app" button beside it.

## Deploy

Vercel or Netlify both detect Vite: build command `npm run build`, output directory `dist`.
Set the `VITE_*` variables in the project's environment settings before building.

GitHub Pages also works out of the box: `.github/workflows/pages.yml` builds on every push to
`main`. In the repo, set **Settings → Pages → Source** to "GitHub Actions" and add the `VITE_*`
values under **Settings → Secrets and variables → Actions → Variables**.
