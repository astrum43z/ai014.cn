# 微观宇宙 · Small Worlds

An independent, Chinese-language interactive science playground for ai014.cn.

Three original browser experiments: a softened central-gravity orbital model, Conway's toroidal Game of Life, and ideal two-source wave interference. Responsive, keyboard-operable controls, reduced-motion support, PNG snapshots, no accounts, trackers, external fonts, API keys, network dependencies, or build step.

## Run

`npm start` or `python3 -m http.server 8140`, then open http://localhost:8140.

## Test

`npm test` (Node.js 18+).

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root). The website uses only static files. Configure ai014.cn as the custom domain after Pages is active, then update the domain DNS. No existing sites need to change.

## Model limits

Orbital simulation fixes the central body, omits mutual forces, and softens gravity inside 18 model units. The cellular automaton wraps at every boundary. Waves are ideal in-phase equal-frequency point sources with no attenuation or reflection. These are educational visualizations, not scientific measurement tools.
