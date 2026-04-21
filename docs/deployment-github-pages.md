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

## Base path configuration

`vite.config.ts` resolves `base` like this:

1. If `VITE_BASE_PATH` is set, that wins.
2. Otherwise, if `GITHUB_PAGES=true` and `GITHUB_REPOSITORY` is available, the app uses `/<repo>/`.
3. Otherwise it falls back to `/`.

Examples:

- User site: `VITE_BASE_PATH=/ npm run build`
- Project site: `VITE_BASE_PATH=/poker-payout-calc/ npm run build`

The GitHub Actions workflow already sets the right behavior for standard project-site deployment.

## Why hash routing was chosen

GitHub Pages is static hosting with no general server-side SPA rewrites. `HashRouter` avoids refresh and deep-link issues because the browser only requests the main HTML file; the route lives after `#`.

That makes deployment more robust than `BrowserRouter` for this MVP.

## Deploy steps

1. Push the repo to GitHub.
2. Ensure the default branch is `main`.
3. Open `Settings > Pages`.
4. Choose `GitHub Actions` as the deployment source.
5. Push a commit to `main` or run the workflow manually.
6. Wait for `.github/workflows/deploy-pages.yml` to finish.

The site URL will be shown in the workflow and in GitHub Pages settings.

## Updating the site later

1. Make code changes locally.
2. Run:

```bash
npm run lint
npm run test
npm run build
```

3. Commit and push to `main`.
4. GitHub Actions rebuilds and redeploys automatically.

## iPhone / Safari storage note

The MVP stores all data in browser storage on the device. That means:

- the data does not sync across devices
- clearing Safari website data can remove the app data
- uninstalling the home-screen shortcut may remove or orphan storage depending on OS/browser behavior

For real-world use, export JSON backups regularly before OS resets, browser cleanup, or phone migration.
