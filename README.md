# hil·attention

Portfolio site for **Hil Kalathiya**, AI engineer. The page treats his story as a transformer:
the hero is a tokenised prompt with live attention arcs, his career is a sequence where every
step attends to earlier ones, and his five projects are attention heads, each drawn as its real
system design with click-to-inspect.

Static site built with [Vite](https://vite.dev). No framework, no runtime dependencies.

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
| `index.html` | Page markup and section structure |
| `src/main.js` | Token arcs, decoding panel, sequence scroll, heads, inspector, theme |
| `src/contact-form.js` | "Leave Hil a message" form |
| `src/style.css` | All styles, light and dark themes as CSS tokens |
| `public/` | Résumé PDF (no phone number), résumé preview, portrait, favicon, OG image |

## Contact form

The form POSTs JSON `{ name, email, message, website, elapsed_ms, page }` to
`VITE_CONTACT_ENDPOINT` (a Supabase RPC). `website` is a honeypot. When `VITE_CONTACT_KEY`
is set it is sent as `apikey` and `Authorization: Bearer` headers (it is the public anon key).
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
