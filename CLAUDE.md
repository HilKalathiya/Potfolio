# Rules for Claude Code in this repo
- Spec: SPEC.md. Read ONLY the § sections named in the prompt. Don't reread unchanged files.
- Facts about Hil come ONLY from `_research/` (resume.txt, readmes/, repos.json) and `content/`. Never invent metrics, dates or claims.
- Stack in SPEC §2 is fixed. Ask before adding any dependency not listed there.
- Keep diffs small. No placeholder lorem ipsum in shipped UI.
- Before finishing a task: run `npm run build` and fix errors. Then append 3–6 lines to PROGRESS.md
  (what changed, files touched, open issues). Keep replies short; no long summaries.
- Never commit secrets. Keys live in `.dev.vars` / Cloudflare dashboard only; `.dev.vars` is gitignored.
- `_research/` is reference data: do not deploy it (exclude from build).
