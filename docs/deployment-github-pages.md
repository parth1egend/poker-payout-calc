# Deployment on GitHub Pages

## Local run

```bash
npm install
npm run dev
```

## Local production preview

```bash
npm run build
npm run preview
```

## Base path behavior

`vite.config.ts` resolves `base` in this order:

1. `VITE_BASE_PATH` if provided
2. `/<repo>/` when `GITHUB_PAGES=true` and `GITHUB_REPOSITORY` is set
3. `/` fallback

Examples:

- user site build: `VITE_BASE_PATH=/ npm run build`
- project site build: `VITE_BASE_PATH=/poker-payout-calc/ npm run build`

The included GitHub Actions workflow sets the right environment for project-site deployment.

## Deploy steps

1. Push repository to GitHub
2. Set default branch to `main`
3. In GitHub: `Settings > Pages`
4. Choose `GitHub Actions` as source
5. Push to `main` (or trigger workflow manually)
6. Wait for `.github/workflows/deploy-pages.yml` to complete

## Updates

For each update:

```bash
npm run lint
npm run test
npm run build
```

Then commit and push. GitHub Actions rebuilds and redeploys.

## iPhone / Safari storage note

The app persists state in browser storage (IndexedDB) on-device:

- data does not sync across devices
- clearing Safari site data removes saved rows
- reinstalling or browser cleanup may wipe local state

Treat the app as local-first storage unless a backend sync layer is added later.
