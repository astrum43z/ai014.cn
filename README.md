# 微观宇宙 · Small Worlds

An independent, Chinese-language interactive science playground for ai014.cn.

Five original browser experiments: a softened central-gravity orbital model, Conway's toroidal Game of Life, ideal two-source wave interference, a seeded triangle chaos game, and a seeded random-walk ensemble. Responsive, keyboard-operable controls, reduced-motion support, PNG snapshots, no accounts, trackers, external fonts, API keys, network dependencies, or build step.

## Run

`npm start` or `python3 -m http.server 8140`, then open http://localhost:8140.

## Test

`npm test` (Node.js 18+).

## Animation efficiency

The animation loop stops while paused, when the document is hidden, or when the canvas is offscreen, and resumes without fast-forwarding. Life redraws only when a generation changes or a control is used. Reduced-motion preferences start experiments paused and enabling the preference during a session pauses immediately. Disabling it does not resume automatically; Continue is an explicit opt-in. Life's arrow keys, Enter, and Space pause before editing, so keyboard-drawn patterns stay still until resumed.

Optional Chromium regression checks: `node tests/browser-check.cjs` and `node tests/performance-check.cjs` while the local server is running. These scripts use the Playwright and Chromium paths configured in their headers.

## Touch drawing

Life drawing tracks one primary pointer. Pointer cancellation, capture loss, clearing, resetting, or switching experiments ends the active stroke, so later hover/move events cannot accidentally keep painting. Taps still toggle cells; the click following a drag does not erase the painted cell. These paths have simulated event regression tests; they are not a substitute for real-device touch checks.

## Parameter links

Share links contain the experiment and validated slider values, not canvas drawings, presets, or running progress. A visible link stays current as parameters change. Back/Forward restores changed experiment settings while preserving the paused state; anchor-only navigation keeps the current simulation intact.

## Guided experiments

Each “try this” card provides a reproducible, paused starting point and specific observations: change gravity while retaining orbital velocity, discover a Life blinker’s two-generation period, and compare a half-wavelength wave path difference with the central axis. Loading clearly replaces the current canvas and settings, resets progress, synchronizes controls and parameter links, and never overrides reduced-motion with autoplay. Share links still contain parameters only, not the guide’s pattern or probe.

## PNG snapshots

Saving captures the current canvas and experiment filename together. The save control waits for encoding before accepting another request. Encoding or download-start failures show a retry message and restore the control; download success text only confirms that a download was started. Temporary links and object URLs are cleaned up.

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root). The website uses only static files. Configure ai014.cn as the custom domain after Pages is active, then update the domain DNS. No existing sites need to change.

## Model limits

Orbital simulation fixes the central body, omits mutual forces, and softens gravity inside 18 model units. The cellular automaton wraps at every boundary. Waves are ideal in-phase equal-frequency point sources with no attenuation or reflection. These are educational visualizations, not scientific measurement tools.

## Randomness and fractals

The fourth experiment starts with 300 points and adds 100 per manual step or at most once per 100 ms during animation. Storage is fixed at 12,000 points, then the animation pauses automatically. Changing jump percentage or seed regenerates the initial 300 points. The same seed, percentage, and point count reproduce identical coordinates regardless of batching. Sharing includes the seed and jump percentage, not the current point count. Reduced motion, visibility suspension, history restoration and PNG export use the existing controls. Four keyboard-accessible tabs wrap dynamically; small screens use a two-column tab grid.

At 50% movement toward uniformly selected triangle vertices, the ideal limit is the Sierpiński triangle with dimension log(3)/log(2). Other movement percentages intentionally explore different attractors; the dimension is not claimed for them. The screen shows a finite pseudorandom approximation, not a measurement. Reference: https://mathworld.wolfram.com/ChaosGame.html

## Connected discovery route

A compact question-led entrance starts the fractal guide, paused. Each experiment has a prediction prompt, a specific thing to notice, a short explanation and a model boundary. Related discoveries form a cycle (fractal → walk → orbit → wave → Life → fractal) while the five experiment tabs remain freely accessible. Entry and next-discovery buttons explicitly disclose that they replace the current canvas and parameters. They reuse the reproducible guides, move focus to the canvas, and never autoplay. No progress tracking, external assets, or additional animation loop is introduced.

Wave probes can also be moved with unmodified arrow keys (2 model units per press) while the canvas has keyboard focus. Home returns to the center. These actions pause the simulation, clamp the probe to the canvas, and announce its position, path difference in wavelengths, and interference classification. Tab and modified shortcuts are left to the browser.

## Reading navigation

The question area links directly to the canvas, live observations, and discovery explanation; both reading sections link back to the existing canvas. These are native, keyboard-accessible page anchors, not experiment resets. Reading headings can receive anchor focus without adding extra Tab stops. Back/Forward between sections preserves the current drawing, point count, generation, wave probe, and pause state. Parameter and share updates retain recognized section anchors. Reduced-motion scrolling follows the existing preference rule.


## Random walk: diffusion and drift

The fifth exhibit follows 256 seeded walkers on an unbounded square lattice. Every step is one unit. Horizontal and vertical motion each have probability 1/2. On a horizontal step, rightward probability is 1/2 + bias/100; the bias slider runs from 0 to 25. Therefore a complete step has mean horizontal displacement μ = bias/100 and unit squared length. Walkers do not collide, wrap, reflect, or experience molecular forces.

After n steps the population moments are E[x] = nμ, E[|r|²] = n + n(n−1)μ², and E[|r−E[r]|²] = n(1−μ²). The displayed theoretical spreading scale is the square root of the last expression. The observed scale is the RMS distance from the **sample centroid**, not distance from the starting point. With 256 finite samples it fluctuates and has the usual small sample-centering bias; equality with theory is not promised. At zero bias, the population RMS scale goes from 4 at 16 steps to 8 at 64 steps. The light circle marks this theoretical scale around the expected center; it is not a boundary, confidence interval, or equal-probability contour (biased walks have unequal x/y variances).

The 16/64 comparison controls recreate the same seeded sequence and pause. A manual step advances 16; animation adds 4 at most once per 100 ms and stops at 512 steps. Coordinates and one representative trajectory use fixed-size typed arrays. Parameters reset to 16 steps; share links carry bias and seed, not progress. The keyboard Right arrow steps and Home restores 16 steps; modified keys remain untouched. Existing reduced-motion, hidden/offscreen suspension, history, presets, reset, and PNG controls apply. The display keeps a minimum range for the initial comparison and expands for drift/outliers, with a visible 10-unit scale; model positions are never clipped to a simulation boundary.

Background: [MIT OpenCourseWare, Random Walkers and Diffusion, §5](https://ocw.mit.edu/courses/18-354j-nonlinear-dynamics-ii-continuum-systems-spring-2015/6fa55d6a1a061e30d32538d51803fbf1_MIT18_354JS15_Ch5.pdf). The biased two-dimensional moment formulas above are derived for this site's explicitly defined step distribution using independence and addition of variances, rather than copied from the one-dimensional example.
