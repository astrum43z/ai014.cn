# 微观宇宙 · Small Worlds

An independent, Chinese-language interactive science playground for ai014.cn.

Three original browser experiments: a softened central-gravity orbital model, Conway's toroidal Game of Life, and ideal two-source wave interference. Responsive, keyboard-operable controls, reduced-motion support, PNG snapshots, no accounts, trackers, external fonts, API keys, network dependencies, or build step.

## Run

`npm start` or `python3 -m http.server 8140`, then open http://localhost:8140.

## Test

`npm test` (Node.js 18+).

## Animation efficiency

The animation loop stops while paused, when the document is hidden, or when the canvas is offscreen, and resumes without fast-forwarding. Life redraws only when a generation changes or a control is used. Reduced-motion preferences start experiments paused and enabling the preference during a session pauses immediately. Disabling it does not resume automatically; Continue is an explicit opt-in. Life's arrow keys, Enter, and Space pause before editing, so keyboard-drawn patterns stay still until resumed.

Optional Chromium regression checks: `node tests/browser-check.cjs` and `node tests/performance-check.cjs` while the local server is running. These scripts use the Playwright and Chromium paths configured in their headers.

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root). The website uses only static files. Configure ai014.cn as the custom domain after Pages is active, then update the domain DNS. No existing sites need to change.

## Model limits

Orbital simulation fixes the central body, omits mutual forces, and softens gravity inside 18 model units. The cellular automaton wraps at every boundary. Waves are ideal in-phase equal-frequency point sources with no attenuation or reflection. These are educational visualizations, not scientific measurement tools.
