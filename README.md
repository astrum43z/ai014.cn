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

Life drawing tracks one primary pointer. Crossing into another cell paints a continuous, one-cell-wide line between event samples, including the initial contact and the final release cell, so fast mouse and touch strokes do not leave gaps. Segments are clamped to the board rather than wrapped. Small movements within one cell remain a tap and toggle that cell once; drawing back over a stroke keeps it alive. Pointer cancellation, capture loss, clearing, resetting, or switching experiments ends the active stroke, so later hover/move events cannot accidentally keep painting. The click following a drag does not erase the painted cell. Drawing pauses the simulation; normal stroke completion announces the current measurements once. These paths have simulated event regression tests; they are not a substitute for real-device touch checks.

## Parameter links

Legacy parameter links still open every experiment with validated sliders. Orbit and Life links remain explicitly parameter-only: they do not include drawings, trajectories, presets, or running progress. Wave, fractal, and random-walk sharing now saves a reproducible observation, as described below. Back/Forward restores changed settings or observation checkpoints; anchor-only navigation keeps current work intact.

## Guided experiments

Each “try this” card provides a reproducible, paused starting point and specific observations: change gravity while retaining orbital velocity, discover a Life blinker’s two-generation period, and compare a half-wavelength wave path difference with the central axis. Loading clearly replaces the current canvas and settings, resets progress, synchronizes controls and parameter links, and never overrides reduced-motion with autoplay. Wave observations can include the guide’s probe. Life links remain parameter-only and do not include the guide’s pattern.

## PNG snapshots

Saving captures the current canvas and experiment filename together. The save control waits for encoding before accepting another request. Encoding or download-start failures show a retry message and restore the control; download success text only confirms that a download was started. Temporary links and object URLs are cleaned up.

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root). The website uses only static files. Configure ai014.cn as the custom domain after Pages is active, then update the domain DNS. No existing sites need to change.

## Model limits

Orbital simulation fixes the central body, omits mutual forces, and softens gravity inside 18 model units. The cellular automaton wraps at every boundary. Waves are ideal in-phase equal-frequency point sources with no attenuation or reflection. These are educational visualizations, not scientific measurement tools.

## Randomness and fractals

The fourth experiment starts with 300 points and adds 100 per manual step or at most once per 100 ms during animation. Storage is fixed at 12,000 points, then the animation pauses automatically. Changing jump percentage or seed regenerates the initial 300 points. The same seed, percentage, and point count reproduce identical coordinates regardless of batching. Observation links include the seed, jump percentage, and exact current point count. Reduced motion, visibility suspension, history restoration and PNG export use the existing controls. Five keyboard-accessible tabs wrap dynamically; small screens keep all five experiments visible in a compact row.

At 50% movement toward uniformly selected triangle vertices, the ideal limit is the Sierpiński triangle with dimension log(3)/log(2). Other movement percentages intentionally explore different attractors; the dimension is not claimed for them. The screen shows a finite pseudorandom approximation, not a measurement. Reference: https://mathworld.wolfram.com/ChaosGame.html

## Connected discovery route

A compact question-led entrance starts the fractal guide, paused. Each experiment has a prediction prompt, a specific thing to notice, a short explanation and a model boundary. Related discoveries form a cycle (fractal → walk → orbit → wave → Life → fractal) while the five experiment tabs remain freely accessible. Entry and next-discovery buttons explicitly disclose that they replace the current canvas and parameters. They reuse the reproducible guides, move focus to the canvas, and never autoplay. No progress tracking, external assets, or additional animation loop is introduced.

Wave probes can also be moved with unmodified arrow keys (2 model units per press) while the canvas has keyboard focus. Home returns to the center. These actions pause the simulation, clamp the probe to the canvas, and announce its position, path difference in wavelengths, and interference classification. Tab and modified shortcuts are left to the browser.

## Reading navigation

The question area links directly to the canvas, live observations, and discovery explanation; both reading sections link back to the existing canvas. These are native, keyboard-accessible page anchors, not experiment resets. Reading headings can receive anchor focus without adding extra Tab stops. Back/Forward between sections preserves the current drawing, point count, generation, wave probe, and pause state. Parameter and share updates retain recognized section anchors. Reduced-motion scrolling follows the existing preference rule.


## Random walk: diffusion and drift

The fifth exhibit follows 256 seeded walkers on an unbounded square lattice. Every step is one unit. Horizontal and vertical motion each have probability 1/2. On a horizontal step, rightward probability is 1/2 + bias/100; the bias slider runs from 0 to 25. Therefore a complete step has mean horizontal displacement μ = bias/100 and unit squared length. Walkers do not collide, wrap, reflect, or experience molecular forces.

After n steps the population moments are E[x] = nμ, E[|r|²] = n + n(n−1)μ², and E[|r−E[r]|²] = n(1−μ²). The displayed theoretical spreading scale is the square root of the last expression. The observed scale is the RMS distance from the **sample centroid**, not distance from the starting point. With 256 finite samples it fluctuates and has the usual small sample-centering bias; equality with theory is not promised. At zero bias, the population RMS scale goes from 4 at 16 steps to 8 at 64 steps. The light circle marks this theoretical scale around the expected center; it is not a boundary, confidence interval, or equal-probability contour (biased walks have unequal x/y variances).

The 16/64 comparison controls recreate the same seeded sequence and pause. A manual step advances 16; animation adds 4 at most once per 100 ms and stops at 512 steps. Coordinates and one representative trajectory use fixed-size typed arrays. Parameters reset to 16 steps; observation links carry bias, seed, and exact current step count. The keyboard Right arrow steps and Home restores 16 steps; modified keys remain untouched. Existing reduced-motion, hidden/offscreen suspension, history, presets, reset, and PNG controls apply. The display keeps a minimum range for the initial comparison and expands for drift/outliers, with a visible 10-unit scale; model positions are never clipped to a simulation boundary.

Background: [MIT OpenCourseWare, Random Walkers and Diffusion, §5](https://ocw.mit.edu/courses/18-354j-nonlinear-dynamics-ii-continuum-systems-spring-2015/6fa55d6a1a061e30d32538d51803fbf1_MIT18_354JS15_Ch5.pdf). The biased two-dimensional moment formulas above are derived for this site's explicitly defined step distribution using independence and addition of variances, rather than copied from the one-dimensional example.

## Keeping experiments within reach

The existing Continue/Pause, single-step, Reset, and Life clear controls sit directly below the canvas, together with the random walk checkpoints. They are single controls, not mirrored copies. On wider screens the compact stage stays visible beside the longer teaching panel; on phones it remains in normal document flow with its controls immediately below. Loading a guided start returns the view and keyboard focus to the paused canvas, ready for the first comparison. No simulation rules or data are changed by this layout.

## Wave probe: a dark instant versus cancellation

The wave stage now separates the two unit-amplitude source contributions at the white probe: A is the left source and B the right. Signed bars and numbers show A, B, and (A+B)/2, using the exact same phase and distances as the field. Dividing the sum by two normalizes the canvas color range to [-1, 1]; it does not imply that physical constructive interference has only a single source's amplitude. The displayed full-cycle maximum of the normalized sum is |cos(π Δr / λ)|, not a maximum measured from a few frames.

The existing paused guide starts at (8, 0), separation 100, wavelength 32. A and B cancel throughout the cycle there. Home moves the probe to (0, 0), where the contributions agree and the normalized full-cycle amplitude is one, even when instantaneous displacement is near zero. Single-step, sliders, reset, presets, keyboard probes and history all refresh the readout. No new experiment, buttons, animation loop or network dependency is added. Source: [OpenStax, University Physics §16.5](https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves).

## Revisit or share an observation

The existing share control reads “暂停并分享此刻” for waves, fractals, and random walks. It pauses before copying a versioned observation URL:

- Waves preserve slider values, the probe’s model coordinates, and simulation time, so source contributions and the cancellation/constructive reading agree on reopening. A saved probe outside a smaller viewport stays visible by fitting the view without changing its model coordinates; Home restores the normal centered view.
- Fractals regenerate the exact seeded sequence through the saved point count (300–12,000).
- Random walks regenerate the exact seeded sequence through the saved step count (16–512), including the representative path and all 256 walkers.

Every valid observation link opens paused, even with ordinary motion preferences. Continue and single-step work from the restored state. The link represents the moment it was created; click Share again after further exploration to save a new moment. Parameter or preset edits remove the old checkpoint and hide its displayed link. A URL is enough to revisit or bookmark the observation; there is no browser storage, server state, tracking, or account. Sharing does not post the link anywhere.

The `at` payload has a version marker, strict field count, finite numbers, and bounded progress. Unsupported versions, duplicates, and invalid payloads fall back to validated parameters, without unbounded replay. Old links are unchanged. Anchor-only Back/Forward preserves ongoing work; a different checkpoint with identical sliders is still restored. Clipboard failure keeps a selectable URL, and late clipboard results do not announce in a different exhibit. Orbit and Life continue to explain their parameter-only limit; PNG remains available for their drawings and trajectories.

## Keyboard shortcuts on experiment tabs

Unmodified Left/Right arrows cycle through the five tabs; Home/End select the first/last tab. Modified keys (Alt, Ctrl, Meta, or Shift) remain available to browser and assistive shortcuts without changing the current experiment, observation link, or pause state. In particular, browser Back/Forward shortcuts must not reset a seeded observation into an adjacent experiment.


## Reading measurements without continuous announcements

The three observation outputs explicitly use `aria-live="off"`, matching the existing wave component outputs. They remain normal readable content under the observation heading; animation does not turn each frame into a live-status announcement. The existing Pause and Step controls send one complete current measurement summary through the polite, atomic action announcement region. Life includes its generation and detected period; seeded experiments retain their progress and limit feedback. Continue still announces only that the simulation resumed. No new controls, live regions, timers, or simulation changes are added.

This follows the [HTML output status mapping](https://www.w3.org/TR/html-aria/#el-output) and [WAI-ARIA live-region semantics](https://www.w3.org/TR/wai-aria-1.2/#aria-live). Automated regression checks cover markup, action summaries, quiet animation, repeated steps, and limits; these checks do not substitute for testing with a physical screen reader.


## Life: explain the next generation one cell at a time

An outlined cell on the Life canvas now has a compact 3×3 neighborhood view, current state, live-neighbor count, and next-generation prediction beneath the existing controls. The preview includes diagonal neighbors, excludes the center from the count, and wraps across the same 48×32 torus as the simulation. It uses the stepper’s shared B3/S23 rule, so prediction and advancement cannot use different transition rules. All cells update simultaneously; the preview always describes the current board’s next generation.

Existing arrow keys move the inspected cell without editing; taps, Enter, and strokes retain their editing behavior. Presets select a cell in their pattern. The paused blinker guide selects its left endpoint: one neighbor predicts death, then the empty position’s three neighbors predict birth on the following step. The position stays fixed while stepping or running. The neighborhood diagram is decorative; plain text supplies the state, count, and rule, and explicit Pause/Step/edit/navigation actions announce the reading through the existing polite region. Animation never generates inspector live announcements. No new controls, animation loops, saved state, dependencies, or Life-sharing claims are added.

Reference for the simultaneously applied B3/S23 rules: [Carter Bays, Complex Systems 1 (1987), §1](https://wpmedia.wolfram.com/sites/13/2018/02/01-3-1.pdf). The finite toroidal boundary is this site’s model choice.


## Orbit: choose a launch point with the keyboard

The orbit canvas has an orange hollow launch marker and a fixed-length tangential direction arrow. With the canvas focused, unmodified arrow keys move the next launch point by 5 model units; Home restores (140, 0), and Enter or Space adds one planet. These actions pause first. Holding a launch key does not add repeated planets. The marker is clamped to the visible canvas on keyboard movement and resize; planets themselves remain unbounded. Pointer taps still launch directly at the tapped position and preserve the existing running/paused state.

A compact, quiet preview shows coordinates, radius, launch speed, and the circular-orbit reference speed at that radius. In this model, the reference is sqrt(gravity × 1000 / radius); the new-planet speed percentage scales it. The preview and both launch methods use one calculation. Changing this slider never changes existing velocities; changing gravity still changes the field for all planets. The arrow indicates direction only, not speed. Radius below 22 is disallowed, outside the softened region at 18. The existing 24-planet cap, resets, parameter-only sharing, reduced-motion behavior, and other exhibits are retained. No extra live region, animation loop, account, or network dependency is added.


## Fractal: follow one random jump

“只走一步 +1” pauses and adds exactly one seeded point; the canvas's unmodified Right arrow does the same, with held-key repeats ignored. The existing 100-point step remains unchanged. A quiet reading names the selected vertex A/B/C and the fraction traveled and remaining. While paused, a hollow departure marker, orange landing dot and solid traveled segment sit on a dashed line toward the selected vertex. The selected vertex is ringed; labels, shapes and text provide alternatives to color. Continue hides the trace so the full pattern can grow unobstructed; Pause, the guide, reduced motion, reset, presets and restored observation links all show the current final jump.

The model records the preceding coordinates during its existing update. It draws no extra random number and uses fixed-size storage; batching, point coordinates, the 12,000-point cap and old observation URLs are unchanged. Replaying any supported seed/proportion/count reconstructs the same last jump, including single-point checkpoints. Repeated vertex choices are allowed. Fraction readings describe the contraction rule, even when successive points are visually too close to distinguish; the line is not a separate trajectory or a probability indicator. No new animation loop, account, saved browser state or dependency is added.


## Random walk: distance traveled versus displacement

The existing white representative walker now has a compact distance reading below the controls. Its traveled distance is the number of unit steps, including repeated or retraced segments; its straight-line distance from the origin is sqrt(x²+y²). Direction counts read the already recorded path and show how opposite steps cancel along each axis. Positive y means up in this exhibit. These are one walker's measurements, explicitly distinct from the 256-walker RMS spreading scale below. More steps need not mean a greater endpoint distance, and neither a particular walker nor its 16/64 ratio is claimed to follow the ensemble square-root law.

While paused, a blue dashed segment connects the origin ring to the current white point; the existing white trajectory remains. When both endpoints coincide the text explains the zero distance. Continue hides the shortcut immediately, and Pause, manual steps, checkpoint buttons, restored observation links, the guide and reduced motion restore it. The camera includes the recorded path's earlier excursions as well as current walkers, so a chosen path is not cropped just because its endpoint returned. The 10-unit scale remains visible when the view changes.

The existing seeded model, random stream, bounded storage, 16/64 comparison controls, presets, 512-step cap and observation URLs are unchanged. Direction counting is a bounded read-only pass over at most 512 recorded steps; no new control, timer, live region, external dependency, or browser storage is introduced. Pause/Step/checkpoint actions include a text summary through the existing polite announcement region; animation readings remain quiet.


## Wave: measure the two paths

When paused, the source-to-probe line from left source A is solid purple, and the line from right source B is dashed orange. Source labels, dash patterns and quiet text readings supplement color. The readout shows each Euclidean distance and their absolute difference divided by wavelength, using the same geometry as the existing interference classification and full-cycle amplitude. The lines represent travel distances, not instantaneous wave displacement or a material trajectory. Continue hides them immediately, leaving the field unobstructed.

Tapping the wave canvas now pauses at the chosen point, matching keyboard probe inspection and making the geometry available on phones without extra controls. Pause, steps, the guide, reset, presets, sliders, reduced motion and observation replay refresh the lines and readings. The guide makes the arithmetic explicit: A travels 58 model units, B 42, and their 16-unit difference is half of wavelength 32. Home returns to equal paths of 50. Outside the two sources, overlapping paths retain the solid line in the dashed line's gaps; at a source one path can be zero. Replayed probes keep their exact model coordinates on narrower screens. No model phase, URL format, animation loop, control, live region or network dependency is added.


## Switch experiments without losing work

The five experiment tabs retain each world's current canvas, parameters, preset, progress, and pause state until this page is refreshed or closed. Returning to Life preserves a hand-drawn pattern, inspected cell and recent history; orbit keeps its bodies and trails; wave keeps its probe and phase; fractal and walk keep their exact seeded continuation. Inactive worlds do not advance. Returning to a running world resumes from its own time without catching up for time spent elsewhere. Enabling reduced motion also pauses the inactive worlds, and turning that preference off never restarts them.

Only one bounded model per inactive exhibit is retained in page memory; there are no extra loops, saved browser storage, accounts, or network calls. Re-selecting the current tab remains a no-op. Reset, presets, guided starts, and explicit URL/history restoration still replace their target state, and the guide buttons keep their existing replacement disclosure. Other experiments remain available. Sharing semantics are unchanged: only wave, fractal and walk observation links reproduce a moment; orbit/Life links still carry parameters only. Previously shown observation links remain fixed checkpoints, even if the live experiment has since advanced. A narrow return keeps a saved wave probe visible without changing its model coordinates.


## Reuse wave geometry while animating

The wave canvas still samples the same 5-pixel grid and uses the same two sine functions, colors, time, source model and probe readings. The two distance-derived phases for each grid square now live in one reusable Float64 array. Advancing time, pausing or moving a probe at the same view scale does not recalculate those distances. Width, height, view scale, wavelength or source separation changes replace the single retained grid, including narrow resizes and restored observations. The cache is drawing data only, separate from the per-experiment model memory; it adds no frame loop, browser storage, controls or network dependency.

`node tests/wave-field-benchmark.js` compares field-sampling CPU time against the original formula, alternates run order, discards warm-up and checks equal checksums. A local Node run measured roughly 60–65% lower repeated sampling time for a 767×317.9375 canvas and a 334×240 canvas. This is not a browser frame-rate, phone or battery benchmark: canvas painting and DOM work are excluded, and rebuilding geometry on a changed view costs a one-time allocation/calculation. The corresponding arrays retain 157,696 and 51,456 bytes. Tests assert exact sample values even at the maximum saved time, exact original colors/positions through app interactions, and no repeated field-distance calls after the cache is built.


## Compact mobile experiment navigation

On screens up to 720 CSS pixels wide, the same five experiment tabs become one 44-pixel-minimum row with short visible labels (引力 / 生命 / 波纹 / 分形 / 漫步). All five remain visible without horizontal scrolling; full experiment names remain their accessible labels, and the current title and question still appear in the experiment. Desktop cards are unchanged. The existing single tab stop, arrow/Home/End navigation, selected state and in-page world retention are reused without new controls or JavaScript.

When the viewport is at least 480 CSS pixels tall, this compact row remains at the top while exploring the lab. Native anchors and guided starts leave room above their targets through scroll padding. In shorter landscape or highly zoomed viewports the row stays in normal flow to leave the limited vertical space free. Nothing is added to browser storage and no world, observation URL or simulation rule changes.
