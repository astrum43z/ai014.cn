# 微观宇宙 · Small Worlds

An independent, Chinese-language interactive science playground for ai014.cn.

Five original browser experiments: a softened central-gravity orbital model, Conway's toroidal Game of Life, ideal two-source wave interference, a seeded triangle chaos game, and a seeded random-walk ensemble. Responsive, keyboard-operable controls, reduced-motion support, PNG snapshots, no accounts, trackers, external fonts, API keys, network dependencies, or build step.

## Vol. 002 · Make a discovery

The homepage now introduces the museum with a real 1,000-point chaos-game specimen and five geometric experiment cards. A visitor can enter a short optional exploration or keep experimenting freely. Existing query links, observation checkpoints, in-page reading links, tab memory, CNAME, and contact footer remain intact.

Each exploration has an explicit paused start, a concrete action, and a model-based check:

- **Orbit:** record radius 75, reduce gravity from 80 to 40, then measure the same first body's radius above 100. A reset or preset replacement invalidates that baseline
- **Life:** draw four cells and verify the entire next board has no births or deaths. Checking does not advance or alter the drawing
- **Waves:** record the half-wavelength cancellation point, move the probe to the center, and compare full-cycle amplitude envelopes rather than one dark frame
- **Fractal:** compare exactly 1,000 points with seeds 14 and 15 at a 50% jump. Count actual model points in the open central triangle, excluding boundary roundoff
- **Walk:** record the same seeded, unbiased ensemble at 16 and 64 steps; report both theoretical and actual measured spread

Loading a preset or repeatedly pressing Check never completes a discovery. Current task state follows the corresponding experiment across tab switches; a different URL state ends that world's active task. Completed field notes are historical observations in page memory only: no storage, account, upload, or inclusion in shared links, and a refresh clears them. Repeating a completed task updates its one note without duplicating it.

### Named keyboard navigation destinations

The home, world chooser, notes and about section anchors accept programmatic focus without adding Tab stops. Native links and browser Back/Forward can land on a named section rather than leaving focus on the page root after a world change removes a control. After a world-changing history restoration, focus is explicitly returned to the addressed section without scrolling. Anchor-only navigation and browser scroll restoration stay native; experiment state, URLs and animation behavior are unchanged.

### Return from a discovery note

Every completed note has a keyboard- and touch-accessible return button. It opens that world’s current in-memory canvas, parameters, pause state, and checkpoint, scrolls to the experiment and focuses the canvas. It never restarts a guide or rewinds to the historical note. Returning to the active world is equally non-destructive. Notes explain this distinction and remain page-only.

### Replay a fractal jump

Near-canvas previous/next controls pause and inspect individual seeded jumps without opening the instrument drawer. Going back replays the same seed and ratio to exactly one fewer point; stepping forward restores the identical jump. The lower bound is the existing 300-point start, preserving shared-observation compatibility; the upper bound remains 12,000. Quiet readings and disabled boundary controls follow animation, parameter changes, checkpoints and tab restoration. Moving through points does not rewrite a previously shared checkpoint or automatically complete a discovery.

### Replay a random-walk step

The near-canvas “退回一步 −1” and “只走一步 +1” controls pause and replay all 256 walkers one seeded step at a time. Rewinding reconstructs the same seed and bias, so advancing again restores every position, the full representative path and the next random draw exactly. A quiet readout follows the white representative walker: latest direction, total path length and straight-line distance from the origin. This lets visitors compare a reversal in both directions without jumping 16 steps or opening detailed instruments. Replay stays within 16–512 steps, with focus-preserving unavailable controls at the bounds; rewinding from the upper limit enables +1 again. It follows checkpoints, animation, parameter changes and tab restoration. Shared URLs remain fixed until shared again, and replay never records a discovery without an explicit successful check. The existing 16-step keyboard and batch controls are unchanged. `tests/walk-replay.test.js` covers exact model/render replay, limits, focus, running-state interruption, sharing, tab and resize restoration, parameter resets and discovery checks.

### Phone-sized controls

Orbit now offers exact five-unit directional buttons, a return-to-(140,0) preview action, and an explicit launch button beside the canvas. Positioning pauses without adding a planet or advancing time; it shares keyboard bounds and the same ten-second preview. The adjacent quiet position/speed and validity readouts stay available with instruments collapsed. Launch is disabled inside the central exclusion zone or at the 24-planet cap, and reset restores it. Direct canvas taps still launch immediately. A five-button Life cursor allows exact cell editing without targeting tiny cells. Its always-visible selected-cell readout shows row, column, current life state and live-neighbor count beside the controls, even when detailed instruments are collapsed. The toggle names its next action (light or extinguish the selected cell). Pointer, keyboard, precision buttons, model steps, resets and tab restoration all use the same model-derived reading; animation does not add live-region announcements. Wave probe arrow buttons move exactly two model units and pause, using the same bounds and behavior as canvas keyboard navigation. The adjacent quiet readout shows model coordinates and full-cycle amplitude even with instruments collapsed; phase changes never add announcements. The center shortcut remains available, and shared checkpoints stay fixed until shared again. Wave center and fractal 1,000-point buttons provide reproducible touch-accessible comparisons. The primary sequence is task → canvas → parameters → expandable detailed instruments, with a near-canvas Check action returning to the visible result. Native details disclosures retain all previous instruments and an additional guided observation method. Keyboard controls, reduced-motion behavior, the compact five-tab row, and semantic reading anchors remain available.

`tests/missions.test.js` exercises every successful path, failed checks, repeated checks, tab round trips, new URL state, replay, baseline replacement, pointer-safe precision controls, measurement consistency, and field-note lifecycle. Run the aggregate test command below after any change.

## Run

`npm start` or `python3 -m http.server 8140`, then open http://localhost:8140.

## Test

`npm test` (Node.js 18+).

## Animation efficiency

The animation loop stops while paused, when the document is hidden, or when the canvas is offscreen, and resumes without fast-forwarding. Life redraws only when a generation changes or a control is used. Reduced-motion preferences start experiments paused and enabling the preference during a session pauses immediately. Disabling it does not resume automatically; Continue is an explicit opt-in. Life's arrow keys, Enter, and Space pause before editing, so keyboard-drawn patterns stay still until resumed.

Optional Chromium regression checks: `node tests/browser-check.cjs` and `node tests/performance-check.cjs` while the local server is running. These scripts use the Playwright and Chromium paths configured in their headers.

## Safe rendering during collapsed layout

Orbit and Walk now omit only plot geometry while their computed drawing scale is nonpositive or nonfinite. Current model readings still update, and the ruler is cleared until a valid layout returns. This prevents negative-radius Canvas arcs from throwing and terminating a running animation chain during a temporary collapse; restoring usable dimensions redraws the same model without resetting its progress, pause choice, checkpoint, recovery or notebook. Visibility, reduced-motion and context-loss gates retain their existing behavior.

`tests/canvas-layout-safety.test.js` reproduces the previous exception with a strict arc mock following the [Canvas standard](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-arc), checks running frame continuity, paused restoration, saved return recovery, and fractional/reflow sizes. These are simulated layout checks; a physical collapsed layout and hardware context loss remain unverified.

## Input-method-safe canvas and tabs

Canvas shortcuts and experiment-tab arrow/Home/End navigation ignore input-method composition events, including the legacy key-code 229 boundary where `isComposing` may already be false. Choosing or confirming a Chinese/Japanese/Korean candidate therefore cannot trigger the custom handler to launch a planet, edit a cell, move a probe, replay a step, pause a model or switch worlds. These events are left to the browser without preventing their default. Normal shortcuts work again on the next non-composing event; no persistent input lock is introduced. Held positioning and intentional Fractal/Walk batch repeats keep their existing behavior.

`tests/composition-input.test.js` covers both signals, all five worlds while running and paused, tab focus, Life gesture and recovery continuity, fixed checkpoints, launch recall, and discovery notes. These are simulated event checks; physical IME candidate-window behavior and assistive-technology input remain unverified. The boundary guard follows [MDN's keydown/IME guidance](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime).

## Touch drawing

Life drawing tracks one primary pointer. With the default drawing tool, crossing into another cell paints a continuous, one-cell-wide line between event samples, including the initial contact and the final release cell, so fast mouse and touch strokes do not leave gaps. Segments are clamped to the board rather than wrapped. Small movements within one cell remain a tap and toggle that cell once; drawing back over a stroke keeps it alive. Pointer cancellation, capture loss, clearing, resetting, or switching experiments ends the active stroke, so later hover/move events cannot accidentally keep painting. The click following a drag does not erase the painted cell. Drawing pauses the simulation; normal stroke completion announces the current measurements once. These paths have simulated event regression tests; they are not a substitute for real-device touch checks.

A completed or cancelled Life stroke keeps a pointer-specific trailing-click guard across precision controls, clearing and recovery, resets, presets, guides, challenges, discovery commands, history restoration and world changes. A delayed drag click therefore cannot erase a cell, launch an Orbit planet or move a Wave probe. Fresh presses replace only their own pointer's guard; other pointers and keyboard-style activation remain usable. Recent guards are bounded because cancelled touches may never emit clicks. Legacy clicks without a pointer ID follow the latest accepted canvas pointer sequence; arbitrary out-of-order legacy clicks cannot identify their original pointer. `tests/life-delayed-click.test.js` covers these deterministic event orders, including independent pending drags, fresh taps and cross-world returns. Physical simultaneous input timing, real-device touch and screen-reader speech remain unverified.

### Undo the last drawing edit

Life’s “撤销上一笔” button beside the drawing tools restores one mistaken tap, keyboard/precision toggle, or an entire continuous drawing/erasing gesture. It restores the pre-edit cells, generation, selected cell, recorded history and any comparison overlay, then stays paused. Partial strokes interrupted by cancellation remain recoverable. A stroke that changes no cells does not replace the useful recovery or discard a comparison. Cursor movement, drawing-tool changes, resizing, parameter adjustments and visits to other worlds keep the recovery; changed parameters and the selected tool are never reverted.

There is one page-only edit snapshot, with no redo or chain of previous recoveries. Continuing, stepping, comparing, clearing or loading another pattern expires it; Clear keeps its separate existing recovery. Restoring a drawing does not complete an exploration, rewrite a shared parameter link or change earned notes. The button remains focusable at its unavailable boundary; nearby quiet text explains availability and expiry. `tests/life-edit-recovery.test.js` covers full-gesture restoration, tap/keyboard/precision paths, no-op strokes, interrupted input, exact model/history/comparison restoration, lifecycle boundaries, fractional generation timing and notebook integrity. These simulated events do not establish physical-touch or screen-reader behavior.

## Parameter links

Legacy parameter links still open every experiment with validated sliders. Orbit and Life links remain explicitly parameter-only: they do not include drawings, trajectories, presets, or running progress. Wave, fractal, and random-walk sharing now saves a reproducible observation, as described below. Back/Forward restores changed settings or observation checkpoints; anchor-only navigation keeps current work intact.

Sharing shows a visible copying result beside the selectable link. When clipboard access is unavailable or fails, the same link stays focused and selected with a manual-copy instruction. Pending copies also allow manual recovery. Retrying replaces the result; late callbacks cannot overwrite a newer attempt, changed parameters, or a different/returned tab. Changing the displayed link clears obsolete copy feedback. The existing polite action region speaks each current terminal result without an additional live region. Continuing an observation keeps its shared link as a fixed checkpoint, as before.

## Guided experiments

Each “try this” card provides a reproducible, paused starting point and specific observations: change gravity while retaining orbital velocity, discover a Life blinker’s two-generation period, and compare a half-wavelength wave path difference with the central axis. Loading clearly replaces the current canvas and settings, resets progress, synchronizes controls and parameter links, and never overrides reduced-motion with autoplay. Wave observations can include the guide’s probe. Life links remain parameter-only and do not include the guide’s pattern.

## PNG snapshots

Saving captures the current canvas and experiment filename together. The save control waits for encoding before accepting another request. The controls show a visible pending message and then a download-start or retry result, identifying the experiment captured when Save was clicked. This stays accurate if the visitor switches experiments during encoding; another save replaces the previous result. Encoding or download-start failures restore the control, and success text only confirms that a download was started, not that the file reached disk. The existing polite action announcement speaks the same result once; the visible status is quiet and associated with the Save button. Temporary links and object URLs are cleaned up. Saving does not pause, step, reset, or change the observation URL.

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → main → / (root). The website uses only static files. Configure ai014.cn as the custom domain after Pages is active, then update the domain DNS. No existing sites need to change.

## Model limits

Orbital simulation fixes the central body, omits mutual forces, and softens gravity inside 18 model units. The cellular automaton wraps at every boundary. Waves are ideal in-phase equal-frequency point sources with no attenuation or reflection. These are educational visualizations, not scientific measurement tools.

## Randomness and fractals

The fourth experiment starts with 300 points and adds 100 per manual step or at most once per 100 ms during animation. Storage is fixed at 12,000 points, then the animation pauses automatically. Changing jump percentage or seed regenerates the initial 300 points. The same seed, percentage, and point count reproduce identical coordinates regardless of batching. Observation links include the seed, jump percentage, and exact current point count. Reduced motion, visibility suspension, history restoration and PNG export use the existing controls. Five keyboard-accessible tabs wrap dynamically; small screens keep all five experiments visible in a compact row.

At 50% movement toward uniformly selected triangle vertices, the ideal limit is the Sierpiński triangle with dimension log(3)/log(2). Other movement percentages intentionally explore different attractors; the dimension is not claimed for them. The screen shows a finite pseudorandom approximation, not a measurement. Reference: https://mathworld.wolfram.com/ChaosGame.html

## Connected discovery route

A compact question-led entrance starts the fractal exploration, paused, or returns to its existing exploration as described below. Each experiment has a prediction prompt, a specific thing to notice, a short explanation and a model boundary. Related discoveries form a cycle (fractal → walk → orbit → wave → Life → fractal) while the five experiment tabs remain freely accessible. The lower reading-route guide button explicitly discloses that it replaces the destination canvas and parameters; the measured exploration shortcuts describe whether they will start, continue or review. They reuse the reproducible guides, move focus to the canvas, and never autoplay. No progress tracking, external assets, or additional animation loop is introduced.

Wave probes can also be moved with unmodified arrow keys (2 model units per press) while the canvas has keyboard focus. Home returns to the center. These actions pause the simulation, clamp the probe to the canvas, and announce its position, path difference in wavelengths, and interference classification. Tab and modified shortcuts are left to the browser.

## Reading navigation

The question area links directly to the canvas, live observations, and discovery explanation; both reading sections link back to the existing canvas. These are native, keyboard-accessible page anchors, not experiment resets. Reading headings can receive anchor focus without adding extra Tab stops. Back/Forward between sections preserves the current drawing, point count, generation, wave probe, and pause state. Parameter and share updates retain recognized section anchors. Reduced-motion scrolling follows the existing preference rule.


## Random walk: diffusion and drift

The fifth exhibit follows 256 seeded walkers on an unbounded square lattice. Every step is one unit. Horizontal and vertical motion each have probability 1/2. On a horizontal step, rightward probability is 1/2 + bias/100; the bias slider runs from 0 to 25. Therefore a complete step has mean horizontal displacement μ = bias/100 and unit squared length. Walkers do not collide, wrap, reflect, or experience molecular forces.

After n steps the population moments are E[x] = nμ, E[|r|²] = n + n(n−1)μ², and E[|r−E[r]|²] = n(1−μ²). The displayed theoretical spreading scale is the square root of the last expression. The observed scale is the RMS distance from the **sample centroid**, not distance from the starting point. With 256 finite samples it fluctuates and has the usual small sample-centering bias; equality with theory is not promised. At zero bias, the population RMS scale goes from 4 at 16 steps to 8 at 64 steps. The light circle marks this theoretical scale around the expected center; it is not a boundary, confidence interval, or equal-probability contour (biased walks have unequal x/y variances).

The 16/64 comparison controls recreate the same seeded sequence and pause. A manual step advances 16; animation adds 4 at most once per 100 ms and stops at 512 steps. Coordinates and one representative trajectory use fixed-size typed arrays. Parameters reset to 16 steps; observation links carry bias, seed, and exact current step count. The keyboard Right arrow steps and Home restores 16 steps; modified keys remain untouched. Existing reduced-motion, hidden/offscreen suspension, history, presets, reset, and PNG controls apply. The display keeps a minimum range for the initial comparison and expands for drift/outliers, with a visible model-unit scale; model positions are never clipped to a simulation boundary.

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

## Mobile reading scale

At widths up to 720 CSS pixels, the existing lesson paragraphs and stage measurements use a 14px reading scale with 1.7–1.8 line spacing. Supporting instructions, model boundaries, sharing limits and reading links use 13px rather than 9–11px. The five compact tabs and simulation controls retain their layout; longer text grows in normal document flow. Wave labels can wrap beside signed values, and the numeric column accommodates five monospaced characters. Desktop styling, model calculations, state, sharing, content and the contact footer are unchanged. `tests/mobile-reading.test.js` guards the mobile-only scope, coverage and wrapping rules; actual layout must also be checked in a browser.


## Optional Life construction challenge

Open “动手挑战 · 4 格，能一直不变吗？” in the Life exhibit. Draw four live cells on the existing board, then test one actual generation. The test uses the same toroidal B3/S23 stepper as ordinary play and compares every cell, including new births. Equal population is not treated as success: a valid solution has exactly four live cells and no changed positions (both blocks and tubs work, including wrapped arrangements). Because this deterministic state is a fixed point, an unchanged generation remains unchanged thereafter unless edited.

The main board shows the tested next generation. Orange crosses mark deaths, blue outlines mark births, and quiet text reports both counts. Return to edit restores the exact pre-test board, generation, focus and recent history. Repeated test clicks do not advance repeatedly; editing, stepping, running, clearing, resets, presets and guide/history loads discard stale comparisons. Ordinary tab switches retain the bounded trial along with the rest of the Life session. Inspecting cells, resizing, reading anchors and parameter-only sharing do not alter the trial. The optional blank start explicitly discloses that it replaces the board and always pauses. No account, grading history, additional simulation loop, persistent storage or sharing-format change is introduced.


## Return to Life editing in view

After a challenge test, “返回修改” restores the original drawing and brings the canvas back into view before focusing it. This matters on narrow or zoomed layouts, where the challenge buttons can be a full screen below the drawing. The scroll uses the same centered behavior as the blank start and respects the existing reduced-motion CSS. The paused state, generation, inspected cell, trial history, and invalidation rules are unchanged; repeated or stale return actions do not move the page.

## Orbit: preview before launch

Pausing reveals a dashed 10-second path from the hollow next-launch marker. A square marks the predicted endpoint, and quiet text supplies its coordinates and distance from the center. Existing arrow keys, Home and the speed/gravity sliders update the path before Enter/Space or a tap adds a planet. No new control or autoplay is introduced. The drawing has its own canvas legend so PNG snapshots distinguish the preview from actual planet trails.

The preview uses a temporary copy of the launch state and exactly 1,000 steps of the existing softened-gravity `orbitStep` at 0.01 seconds, matching 100 manual advances. It does not advance time, add a planet, mutate existing bodies, or record a trail. It assumes constant gravity and shows a finite numerical segment, not a complete orbit or an escape classification; an offscreen endpoint is still reported in text. Real-time animation uses its existing frame-dependent integration steps, so it can differ slightly. One cached path of 201 points is reused until launch coordinates, gravity or launch speed changes. Running, invalid center placement and the 24-planet cap hide the preview; pausing, reset, guided starts and returning to the tab restore the appropriate one. Orbit sharing remains parameter-only.


## Life: one cell toggle per key press

Holding Enter or Space now toggles the selected cell only once, so the key-repeat delay cannot accidentally erase a deliberate drawing. Release and press again to toggle it back. Held arrow keys still move across the board and wrap at its edges. The first toggle pauses as before; repeated toggle events do not redraw, announce, or invalidate a challenge comparison. Space repeats still prevent page scrolling. No simulation, pointer, sharing, or layout behavior changes.


## Easier parameter-slider targeting

All ten parameter sliders keep their native range controls and now have a 44px-high input box on desktop, touch laptops, and narrow layouts. The top margin shrinks from 15px to 1px so the track stays at the same distance below its label; the hit area expands above and below it. The existing focus outline is inset into the expanded input so it does not cover the label. Native dragging, keyboard arrows/Home/End, value ranges and experiment behavior are unchanged. This does not enlarge the track or thumb artwork, or add extra controls, event handlers, dependencies or saved state.

`tests/slider-targets.test.js` guards the global input size, unchanged track center and native semantics. Browser QA also checks computed geometry and keyboard behavior at desktop and narrow widths; narrow browser zoom is not a physical touch-device test.


## Life: change speed without skipping generations

The evolution-speed slider now preserves the completed fraction of the next generation when its rate changes. For example, waiting 90% of one generation at 1 generation/second still means 90% at 20/second, rather than treating the old 0.9 seconds as 18 generations to replay immediately. This applies while running or paused, including repeated adjustments and returning from another experiment. Lowering the speed preserves the same fractional progress. Moving the slider never advances the board or resumes a paused simulation.

The B3/S23 rules, current drawing, completed-generation count, manual step, resets, density setting, existing single animation loop, and sharing format remain unchanged. Eight event-driven runtime tests cover acceleration, slowdown, pause/resume, repeated changes, tab returns, density edits and reset/manual-step behavior; five fail against the preceding implementation.


## Life: stop interrupted strokes safely

Leaving the browser window or hiding the page now ends any unfinished Life drawing gesture while keeping its already painted cells. Returning cannot extend the old stroke or turn a trailing release into a new tap. A move reporting that the primary button is no longer held also cancels, including multi-button mouse releases where another button remains down. A fresh tap or drag starts normally, even with the same pointer ID.

Completed strokes keep their click-suppression guard, ordinary visibility notifications do not interrupt a visible drawing, and secondary pointers cannot cancel the owning pointer. These safeguards do not reset a board, discard a completed challenge, change simulation timing, or add controls. Six event-driven regression cases cover interruptions, trailing events, repeated interruption, hover, button combinations and recovery; actual device and operating-system event ordering can differ.

## Avoid redundant live-reading text replacements

Animation readouts now compare their next text with the current DOM before setting it. Unchanged Orbit launch instructions, Wave path measurements, and shared observation explanations keep their text nodes; changed numeric readings, paused previews, probe movement, presets, resets, tab returns, and history navigation still refresh normally. There is no additional state cache, changed physics, animation cadence, layout, or live-announcement behavior.

An event-driven 120-frame test eliminates 960 redundant static-text assignments in Orbit and 1,080 in Wave while verifying that dynamic readings keep changing. Tests also cover paused redraws, edits, all five tabs, and history restoration. These are deterministic DOM-write counts, not measured browser FPS, battery, or screen-reader improvements.


## Keep keyboard focus at fractal limits

The three single-point fractal controls remain focusable when unavailable at the 300-point starting floor or 12,000-point ceiling. They expose `aria-disabled`, keep a muted appearance and their normal focus outline, and are described by the current point reading plus the existing instructions. Reaching a limit no longer drops focus to the page; Tab and Shift+Tab remain available for moving to another control. Disabled activation is a true no-op: it does not redraw, announce again, alter a shared checkpoint, or restart animation. Backward replay makes forward stepping available again.

The point bounds, exact seeded coordinates, 100-point control, canvas shortcuts, session retention and sharing format are unchanged. Tests cover availability through input changes, reset, tab return and history, plus repeated disabled clicks and canvas commands. Focus retention is also checked through normal keyboard interaction in the public cloud browser; this does not verify screen-reader speech or a physical mobile device.


## Keep keyboard focus at walk and launch limits

The near-canvas “只走一步 +1” and “从标记处发射” buttons stay in the keyboard sequence when unavailable. Reaching 512 walk steps or launching the 24th planet no longer drops the initiating button's focus to the page root. The same applies to a launch marker inside the central exclusion zone. Current readings explain the boundary, and `aria-disabled` with muted colors preserves the normal focus outline. Unavailable button activation does nothing, including no repeated announcement, redraw, model update, pause change or URL change. Comparison, reset or moving to a valid launch position restores availability as appropriate.

This extends the existing fractal boundary behavior to the remaining precision actions. Canvas launch guidance and keyboard shortcuts, seeded walks, physical limits, tab memory and observation links are unchanged. Deterministic tests cover repeated activation, animation reaching the limit, tab return, reset and history. Public cloud-browser keyboard verification is separate from real-device touch and screen-reader speech, which remain unverified.


## Life precision toggle: one edit per Enter press

Holding Enter on “点亮所选格 / 熄灭所选格” no longer repeatedly undoes and reapplies the same cell. The first native activation still pauses and edits once; releasing and pressing again edits again. Space retains its native release-to-activate behavior, and pointer taps, focus, Tab navigation, directional controls and canvas shortcuts stay unchanged. The handler only prevents repeated Enter default activation, so there is no held-key state to get stuck after focus or tab changes.

Four event-driven tests cover repeats, fresh presses, unchanged challenge comparisons, native-key pass-through, independent clicks, tab return, reset and history. Three regression cases fail against the previous implementation. Public cloud-browser keyboard checks separately exercise native repeated-key activation; physical mobile input and screen-reader speech remain unverified.

## Save completed discoveries

Once a visitor completes an exploration, the notebook offers “保存本次发现”. It downloads all currently completed discoveries as a Chinese UTF-8 text file, including each world's name, finding and exact recorded measurements. The file identifies those readings as historical evidence rather than the current canvas, and makes clear that it cannot recreate the simulation. It includes no personal data, browser storage or upload. Restarting an exploration keeps its previous note; completing it again updates the same entry. Downloading does not pause, reset, step, navigate or alter the shared checkpoint.

The control stays hidden before the first completed discovery. A visible, quiet result plus the existing action announcement confirms only that downloading was initiated, or explains how to retry. Temporary links and object URLs are released; repeated Enter defaults are suppressed so holding the key does not start a stream of files. A new completed note clears outdated save feedback. Page notes still disappear on refresh, with the save option explained beside that warning.

`tests/field-notes.test.js` checks the exact text and UTF-8 bytes, all five completed findings, empty and unfinished states, preserved historical evidence, replays, changed URL state, download failures and cleanup, intentional repeat saves, held-key pass-through, focus and model invariants, and the wrapping 44px control. Browser download and keyboard checks are performed on the public release; automated event tests do not establish physical-device touch or screen-reader speech behavior.

## Review and manually copy completed discoveries

The notebook also offers an optional “查看与复制文字” disclosure after the first completed discovery. Its labelled, read-only text area contains exactly the same Chinese text as the TXT export. Visitors can review it first, select a passage, or use “全选文字” and their own copy command. No automatic clipboard access or permission is needed, and selecting text never claims it has been copied. The field uses 16px text, wraps within its container and resizes vertically; the disclosure and selection control have 44px minimum targets and visible keyboard focus.

The view updates only when the recorded text changes, preserving native selection and scroll across unchanged experiment renders. Completing another exploration or recompleting one updates the historical entries; live simulation changes, restarting an exploration and browser history do not overwrite earned findings. Opening, selecting and closing the view do not alter the simulation, shared checkpoint, download feedback or notebook. Tests cover all five findings, refresh, replay, replacement, selection/focus, unchanged rendering and model invariants. Physical-device touch and screen-reader speech require separate verification.


## Exact parameter adjustments

Every native parameter slider now has adjacent −1 / +1 buttons. These keep the full-width slider for broad changes while making small comparisons, such as fractal seed 14 → 15, possible without precise dragging. All buttons have 44px minimum targets, specific accessible names, the quiet current-value output as their description, and the same integer bounds as their range. Percentages change by one percentage point. A boundary button remains focusable and its guarded action is a no-op; moving away from a boundary restores it.

Ranges and buttons share one update path. Life rate changes preserve the fractional generation; density does not reseed a drawing; existing orbit bodies and wave probes remain in place; fractal and walk changes regenerate their existing 300-point / 16-step starts. Pause state, seeded models, preset behavior, tab memory, discovery checks and observation-sharing semantics are retained. Button actions announce the new value through the existing polite region, with explicit regeneration text where applicable. No storage, dependency or domain change is introduced.

## Know what a parameter change will affect

A short, quiet note now sits immediately below the affected controls: Orbit speed applies only to the next launch, Life density is the per-cell sampling probability for the next random sow, and fractal/walk edits restart at 300 points/16 steps while retaining the current running or paused state. The note describes only the relevant native ranges and −1/+1 buttons through `aria-describedby`; the two seeded parameters share one visible note. Speed and density button feedback also identifies their deferred effect.

Percentage ranges now expose their current value with `%` through `aria-valuetext`, and Life rate reads as “每秒 N 代”. The same synchronization path updates these values after native input, exact adjustments, presets, guides, shared URLs and tab restoration. Unitless ranges retain native numeric semantics. There is no new live region, focus stop, parameter/model behavior, storage or network request. Tests verify help associations, units, restoration paths, unchanged current Life/Orbit work, and continued animation after seeded rebuilds. Screen-reader speech and physical-device behavior still require separate verification.


## Random sow means a fresh random board

Life’s “随机播种” button now always selects the existing random-garden preset and samples all 1,536 cells using the current density. Previously it advanced through named presets, so clicking the advertised random action could produce a three-cell blinker instead. Repeated clicks create fresh generation-zero boards; density changes alone still leave the current drawing untouched. The selected preset and existing status message now reflect the actual random sow. Named glider, blinker and pulsar patterns remain directly selectable, and the other four experiments retain their preset cycling.

The change reuses the existing reset, sampling and rendering path, preserving pause/running state, focus, history cleanup, tab memory and parameter-only Life sharing. No new controls, data storage, random algorithm, dependency or domain change is introduced. Regression tests use controlled samples to verify strict per-cell thresholds at 10%, 30% and 60%, every starting preset, repeated sowing, named patterns and unaffected experiment cycles.


## One pause toggle per Enter press

Holding Enter on the shared Pause/Continue button now changes motion state only once. Repeated native keydown activation can no longer undo a pause or keep stopping and restarting a continued simulation. Release and press again to toggle intentionally. The initial native activation, Space's release-to-activate behavior, pointer clicks, focus, Tab navigation, per-world pause memory and reduced-motion opt-in remain unchanged. No held-key state, timers or new controls are introduced.

Five event-driven tests exercise both directions across all five worlds, shared checkpoints, reduced-motion changes, seeded progress limits, Life comparisons, fresh presses and tab returns. They model native Enter default activation and fail against the previous implementation. Public-browser keyboard checks are separate from physical-device and screen-reader testing.

## Keep wave measurements visible while resizing

A wave probe selected near a wide canvas edge now stays fully visible when the viewport narrows or the visitor zooms, including a resize while another world is active. The viewport includes the current probe with an 18-pixel margin without moving its model coordinates, advancing phase, changing pause state, rewriting a shared checkpoint, or adding announcements. A wider saved view remains intact; ordinary arrow/button movement still uses a stable field scale and existing bounds. Home, reset and presets release the expanded view as before.

`tests/wave-resize.test.js` covers pointer and precision-selected probes, multiple aspect ratios, running/paused state, tab restoration, fixed shared links, ordinary movement bounds, and recovery to the default scale. These simulated resize tests complement public-browser zoom checks; physical device rotation is not claimed.

## Resize the view, keep the orbit launch

Narrowing the viewport or zooming no longer moves a selected orbit launch point or changes its speed and ten-second prediction. The view fits the marker and its direction arrow with the same 34-pixel margin used by precision placement. Current planets, elapsed time, pause state and parameter links are preserved, including when the viewport changes while another world is active.

Pointer launches, precision buttons and canvas keys use the same displayed scale. Directional movement retains a stable, bounded view rather than continually zooming out. Home, reset, presets, guided starts and new URL settings return to the normal view. Existing planets remain free to leave the screen; fitting is for the next launch point, not a change to the gravity model.

`tests/orbit-resize.test.js` covers all pointer quadrants, narrow/tall/fractional canvas sizes, tab restoration, unchanged readings and bodies, exact five-unit movement, bounded repeats, launch-to-preview agreement after resizing, resets and launch limits. Public cloud-browser zoom checks complement these deterministic tests; physical-device rotation and screen-reader speech are not claimed.


## Recover an accidentally cleared Life drawing

Life now keeps one page-only snapshot for its explicit Clear action. The adjacent “撤销清空” button restores the exact cells, generation, selected cell, observation history, and any open before/after challenge comparison, and leaves the simulation paused. Its quiet message identifies the recoverable generation and live-cell count. Repeated clearing of the untouched blank board preserves the original snapshot. The consumed control stays focusable with a guarded unavailable state.

Moving the cursor, resizing, changing rate or density, sharing parameters, and visiting other worlds retain recovery. Editing cells, advancing or continuing the simulation, testing a generation, loading a preset or guide, resetting, or restoring different Life URL settings discards it, so undo cannot overwrite newer work. Restoring retains the pre-clear fractional generation at the current rate; it does not revert parameters, shared URLs, earned notes, or discovery progress. Refresh clears the snapshot; nothing is stored or uploaded.

`tests/life-clear-recovery.test.js` covers exact restoration, repeated clear/undo, focus, cadence, interrupted drawing, comparisons, tab/history transitions, invalidation and unaffected worlds. Public cloud-browser checks supplement these deterministic tests; physical touch and screen-reader speech require separate verification.

## Compare wave motion in quarter cycles

Wave’s existing single-step control now reads “推进 ¼ 周期” and pauses after advancing exactly one quarter of the model’s oscillation period (π/6 seconds at its unchanged angular frequency of 3 radians/second). The field, probe contributions and manual step share that frequency constant. With parameters and probe held fixed, two activations reverse signed displacement and four reproduce the wave field within floating-point precision; elapsed time still moves forward. Compact near-canvas guidance explains this comparison and the persistently near-zero displacement at cancellation points.

No control is added. Other worlds retain their step sizes and labels. Wave’s accessible name spells out the fraction, its description references the visible guidance, and leaving Wave clears that association. The action reuses the existing paused render and single polite announcement, while animation remains quiet. Probe geometry, full-cycle amplitude, fixed shared checkpoints, tab memory, presets, resets, missions and earned notes retain their existing behavior. Observation links preserve the advanced time exactly.

`tests/wave-cycle-step.test.js` covers quarter/half/full cycles at central, cancelling and mixed probes, a central dark instant, nonzero shared times, running/reduced-motion behavior, focus, all other worlds, parameter changes, reset/preset/guide/history, notebook isolation and markup. The existing field-render regression now checks the quarter-cycle clock against every rendered sample. Public cloud-browser checks supplement these deterministic tests; physical touch and screen-reader speech remain unverified.


## Return to an unfinished discovery

The homepage’s existing starter and a completed exploration’s next-discovery shortcut now return to an already-started destination instead of loading its starting point again. Their labels distinguish “先试一个” / “下一个发现”, “继续探索”, and “回看发现”; adjacent descriptions identify replacement only for a new start. Existing missions retain their current model, parameters, progress, captured comparison, feedback, fixed shared checkpoint, and running or paused state. Active returns focus the instructions; completed returns scroll the recorded result into view and focus it without replaying historical measurements over a newer canvas. Repeated entry is non-destructive.

The explicit “重新开始” action still replaces the target exploration, and unstarted destinations still initialize paused even if they have free-play progress. A historical notebook entry does not restore a mission invalidated by a new URL state. Anchor navigation, other worlds, guide-reset controls, reduced motion and the page-only lifetime remain unchanged. No new control, model, storage, network request or animation loop is introduced.

`tests/discovery-return.test.js` covers homepage re-entry, every active and completed next destination, partial Life drawings, retained comparison evidence, shared checkpoints, newer completed canvases, running returns without catch-up, reduced motion, explicit restart, history, refresh, disclosure associations and scroll/focus order. Public cloud-browser checks complement the deterministic tests; physical touch and screen-reader speech are not claimed.

## Finish a Life stroke before the next command

Life now ends an unfinished pointer stroke when the visitor advances a generation, chooses Continue, or uses an accepted canvas editing/navigation key. These commands release capture before changing the board or selection, retain cells already painted, and ignore the old pointer’s delayed move, release and synthetic click. A new stroke with the same pointer works normally. This prevents a held mouse, pen or touch gesture from painting across a newly evolved board or pulling the keyboard selection back to its old position.

The existing interruption helper preserves suppression for an already completed drag. Unhandled keys and reserved Alt/Ctrl/Meta shortcuts, ignored held-toggle repeats, and parameter-only changes do not cancel a valid stroke. The change adds no controls, timing state, storage or model changes; clear recovery, challenge comparisons, per-world memory and normal controls remain intact. Regression tests exercise synchronous capture loss, delayed events, interrupted taps and strokes, a running later generation, all six canvas keys, repeated navigation, fresh pointer reuse and all five worlds. Public cloud-browser smoke checks complement deterministic event tests; simultaneous physical inputs, physical touch and screen-reader speech are not claimed.

## Read Life's population history

The Life history now uses an HTML figure for visibility, so its chart appears when Life is selected. Previously the app assigned `.hidden` to an SVG while its initial `hidden` attribute remained in place, leaving the plot invisible in the public browser. The chart hides in other worlds and returns with Life's retained history.

A quiet caption gives the recorded generation range, starting and current populations, and minimum/maximum counts. Numeric axes identify the window's changing scale; the zero-based vertical axis uses 1 as its upper bound for an entirely empty record. A current-value marker makes even the first observation visible. The visual plot is decorative to assistive technology because the caption supplies its summary, without a new live region or keyboard stop. A flat population line is explicitly distinguished from an unchanged board.

The same at-most-120 observations and exact-board period checks remain in use. Editing starts a new record; reset, presets, challenge return, clear/undo and tab memory retain their existing behavior. The change adds no stored data, controls, model steps, animation loop or network requests. Tests cover single and empty samples, the pulsar's 48 → 56 → 72 → 48 counts, flat oscillators versus still life, rolling-window bounds, unchanged redraws, restores and quiet animation. Public cloud-browser checks verify visibility and zoomed layout separately; physical-device touch, rotation and screen-reader speech are not claimed.


## Decode a wave's color at the canvas

A compact key beside the Wave field now identifies teal as negative displacement, deep green as zero, and yellow-green as positive. Its swatches match the renderer's full-scale negative, zero and positive colors; text labels keep the meaning available without distinguishing the colors. A quiet, signed probe reading gives the current normalized displacement `(A+B)/2`, using the same two-decimal value as the detailed instruments. It stays available while those instruments are folded. Nearby guidance distinguishes a dark instant from low amplitude over the full cycle.

The key appears only in Wave and returns correctly through tab memory, shared observations, guides and history navigation. It adds no control, focus stop, live-region announcements, model steps, storage or network dependency. The reading only replaces its text when the displayed value changes. Tests cover positive/negative/rounded-zero values, quarter-cycle reversal, cancellation, parameter/probe changes, quiet animation, restoration and unchanged simulations. Public cloud-browser checks supplement deterministic tests; physical touch, device rotation and screen-reader speech are not claimed.


## Keep Life edits inside the same canvas geometry

An in-progress Life tap or stroke now ends when the canvas changes size. Already painted cells and the selected cell are retained; a delayed move, release or synthetic click cannot connect the old grid position to the resized grid. Pointer samples also check the rectangle captured at the start, covering a layout or scroll shift and events delivered before ResizeObserver. An unchanged-size redraw or device-pixel-ratio change does not end a valid stroke. A fresh gesture, including reuse of the same pointer ID, works normally.

Clicks now share the same bounded cell mapping as strokes. A captured tap slipping just outside the left or top edge stays on its edge cell instead of wrapping into a different row or reporting column zero. Invalid coordinates and collapsed canvas bounds do not edit the board. This changes no Life rules, controls, URLs, stored state, or other experiments. Clear recovery and challenge comparisons are retained when geometry interrupts a tap without editing it.

`tests/life-pointer-geometry.test.js` covers resized and shifted rectangles, observer timing, taps and strokes, synchronous capture loss, delayed events, fresh pointer reuse, all four edges, invalid input, repeated redraws and unaffected worlds. Deterministic event tests verify interrupted input; public cloud-browser checks cover ordinary drawing, precision controls and zoomed layout separately. Physical touch, rotation, simultaneous hardware inputs and screen-reader speech remain unverified.

## Choose a preset before replacing the canvas

The native preset menu now chooses an action without immediately loading it. A separate “载入所选预设” button performs the replacement, allowing keyboard users to browse choices safely and visitors to reload the same named pattern after editing or evolving it. A held Enter does not repeatedly activate the load button. Initial and reset states show an empty “先选择一个预设” prompt rather than falsely naming the first preset; the unavailable load button remains focusable and is guarded in code.

Guidance beside the menu explains replacement, possible preset parameter changes, repeated loading, and Reset's existing behavior: retain current parameters and reconstruct the default starting model. Reset does not replay a previously selected pattern. Pending choices are retained independently per world, without changing the current canvas, running state, shared checkpoint, Life comparison or clear recovery. Loading uses the existing preset path; shortcut cycling follows the last actually loaded preset, not an uncommitted menu choice. Random sowing, seeded sequences, discovery checks, pause behavior and model rules remain unchanged.

`tests/preset-loading.test.js` covers initial choices, non-destructive browsing, repeated named loads, reset labeling, keyboard repeat protection, invalid choices, per-world pending selection, shared checkpoints, Life recovery/comparisons and shortcut cycling. Existing preset tests now perform both explicit UI actions. Public cloud-browser verification covers native keyboard selection, reload and reset plus zoomed layout; physical touch, rotation and screen-reader speech remain separate verification limits.


## Keep a saved fractal observation while comparing

The near-canvas “比较 1,000 点” action now retains an existing observation URL and its visible copy field. It still rebuilds exactly 1,000 points with the current seed and jump percentage, then pauses. Previously this same-parameter comparison cleared the saved checkpoint, unlike single-point replay and the walk comparison controls. The saved link continues to represent the earlier moment; Share explicitly replaces it with the current comparison. Parameter-only starts remain parameter-only until shared.

Repeated comparison, tab returns and anchor navigation preserve the current canvas separately from its saved observation. Existing copy success, manual-copy recovery and pending-copy feedback remain tied to that link. Parameter/preset edits, guided replacement and a genuinely different URL still invalidate or replace it as before. No model, control, layout, storage, dependency or domain change is introduced.

`tests/fractal-checkpoint.test.js` covers progress boundaries, exact seeded replay, running/reduced-motion behavior, focus, pending choices, hidden controls, sharing/re-sharing, copy failure and races, tab/history restoration, explicit replacements and discovery evidence. Public cloud-browser checks reproduce the old behavior and verify the published fix; physical touch and screen-reader speech remain unverified.


## Know where further reading leads

Each experiment's existing external reference now names its publisher and topic rather than the same generic link label. A visible description, associated with the link for assistive technology, identifies the English content and new-tab behavior. Walk specifically identifies its six-page PDF; Wave identifies its textbook chapter. The five existing URLs, native link behavior and opener/referrer protections stay unchanged. The default HTML also contains the complete Orbit reference before JavaScript starts.

Reference titles wrap in a flexible layout, retain visible keyboard focus and use a minimum 44-pixel link target. Descriptions follow direct links, tab returns, guides and history restoration without a live region or additional control. This adds no model step, saved data, dependency or network request. Source titles, formats and the PDF page count were checked at their existing destinations on 2026-10-02.

`tests/reading-sources.test.js` covers every source, repeated transitions, PDF-description clearing, history, fixed checkpoints versus live canvases, preset/parameter/guide changes, native markup and responsive styles. Public cloud-browser checks cover the published labels, keyboard navigation and zoomed layout; physical touch and screen-reader speech remain separate verification limits.


## Return from parameters to the canvas

A native “回到画布，继续实验” link immediately follows the parameter sliders and their effect guidance. On the stacked phone/zoomed layout, visitors can now go straight back to the canvas after an adjustment, before passing the preset, save, share and reading controls. It reuses the existing visible focus style and 44-pixel reading-link target, spans the controls grid, and wraps at narrow widths.

The link moves native focus and navigation to the current canvas. It does not restart, pause, step or change parameters; effects that apply only to the next launch or random sowing still work that way. Existing Back/Forward handling, per-world state and fixed observation checkpoints remain unchanged. No new JavaScript handler, animation, storage or dependency is added.

`tests/parameter-return.test.js` checks native semantics and placement, responsive styling, all five worlds after parameter edits, running-state preservation, fixed checkpoints and Life clear recovery. Public cloud-browser checks cover keyboard/pointer return and Back/Forward at normal and zoomed widths; physical touch, device rotation and screen-reader speech are not claimed.


## Read the exploration's current step

Exploration steps now say “当前步骤” or “已完成” in visible text, and exactly the current list item exposes `aria-current="step"`. Visitors can identify progress without relying on bold text, color or a generated checkmark. Idle and upcoming steps retain their original action labels; the existing wrapping layout handles the longer completed/current labels. No extra keyboard stop or live region is added.

The labels follow the existing checked milestones: only an explicit successful check advances a comparison, with Life's cleared starting board already marked complete. Growing a sample or changing a parameter does not claim an unchecked result. Completed steps remain historical after further experimentation, survive tab/anchor returns, and clear when a genuinely different URL starts a new experiment. Restart retains earlier notebook entries. Models, pause behavior, fixed shared observations, and the number of steps are unchanged.

`tests/mission-progress.test.js` covers all five starts, failed/repeated checks, verified comparisons and completion, restarts, tab and history restoration, historical notes, fixed checkpoints, and quiet animation. Public cloud-browser checks cover visible/accessible wording and zoomed wrapping; physical touch, rotation and screen-reader speech remain unverified.


## Know what a check does before using it

The exploration's two check controls now have nearby effect descriptions, associated with their buttons for assistive technology: checking pauses without advancing the simulation, and only completing the exploration adds a notebook entry. The near-canvas description also explains that the result returns to the exploration above. These quiet descriptions appear with the active controls and disappear for idle or completed explorations.

Life's optional instrument action now says “前进一代并对比”. Its associated description explicitly explains that this comparison pauses and advances one generation, can return to the original drawing, and does not itself write a discovery. Continue, a model step or an edit ends the comparison as before. The separate clearing action keeps its own replacement warning. This distinguishes the two existing operations without changing either operation, scientific checks, notebook rules, focus behavior, shared observations or simulation models.

`tests/check-effects.test.js` verifies all five non-advancing exploration checks, pause behavior, help visibility through completion/restart/tab/history, fixed checkpoints, actual Life advance/return, notebook boundaries and quiet animation. Existing native wrapping and 44-pixel controls are retained. Physical touch, rotation and screen-reader speech are outside these automated checks.


## Keep a Life comparison open after a held Enter

Starting Life's “前进一代并对比” transfers keyboard focus to “返回修改”. That return control now ignores repeated Enter keydowns, so holding the comparison's activation key cannot immediately restore the original drawing and hide the result. A fresh Enter, Space, pointer or assistive activation still returns normally; existing canvas repeat protection prevents a held Return from editing a cell after focus moves back. The change adds no timer or key-state tracking.

`tests/life-comparison-key.test.js` covers focus transfer, successful and unsuccessful comparisons, exact return, running and paused starts, three evolution rates, tab/anchor/resize and clear recovery, ordinary keys and clicks, plus discovery and shared-link isolation. The four regression cases fail on the previous implementation; the ordinary-input preservation case passes before and after. The original failure was reproduced using a held native Enter in the public cloud browser; physical touch and screen-reader speech remain separate verification limits.

## Inspect one replay event per key press

Fractal's three one-point controls and Walk's two one-step controls now ignore repeated Enter keydowns. A held activation therefore retains the single point or step being inspected instead of silently skipping through the seeded sequence. Fresh Enter presses, native Space activation and clicks still use the same exact replay actions; batch stepping and directional movement remain unchanged. No timers, held-key state, model changes or new controls are introduced.

`tests/replay-key.test.js` covers all five controls from running and paused starts, exact seeded return, both bounds and focus retention, shared checkpoints, tab/history/resize restoration, ordinary input and discovery boundaries. The skip was reproduced in the public cloud browser: holding Enter for 1.2 seconds on “只添一点 +1” advanced 15 points. Real-device touch and screen-reader speech remain outside these checks.


## Recognize completed simulation limits

At the 12,000-point fractal cap or 512-step walk cap, the main Continue and batch Step controls now expose `aria-disabled="true"` and use the same legible unavailable colors as the exact-step controls. They keep their native keyboard focus and refer to the existing adjacent limit reading, which explains how to rewind or reset. Activating the capped batch step does not redraw, change a checkpoint, or schedule animation. Continue retains its existing spoken explanation of the limit.

Availability is derived from the current model when drawing, so exact or batch advancement, animation, direct observation links, history restoration and tab return agree. Rewinding, comparison checkpoints, resets, parameter changes, presets and guided starts restore availability immediately. Orbit, Life and wave controls remain usable; the wave step keeps its quarter-cycle description. There are no new controls, live regions, model rules, storage or dependencies. `tests/progress-limit.test.js` covers caps, focus preservation, inert repetition and all recovery paths. Physical screen-reader speech remains unverified.


## Replay a Life generation

The near-canvas “退回一代 −1” control pauses and restores the exact previous recorded Life board. It reuses the existing bounded 120-observation history rather than attempting to invert the rules or adding another board archive. Repeated rewinds can reach the earliest retained generation, with a quiet reading naming that boundary. Forward stepping recomputes the same next board. The button stays focusable but unavailable when there is no immediately preceding generation; a held Enter performs only one rewind.

Drawing, clearing, presets, guides, resets and a different URL start a new history as before, so rewind cannot cross into an unrelated drawing. Tab returns, rate/density changes, selection movement and ordinary resizing retain the current history. Rewinding cancels an active pointer gesture, clears the one-generation comparison overlay and clear-recovery state, and resets the partial-generation timer; delayed events cannot repaint the restored board. It retains the selected cell, parameters, fixed URL and earned discovery notes. It never automatically completes a discovery. The existing challenge’s return action and Clear undo remain available for their distinct purposes.

`tests/life-rewind.test.js` checks exact forward/backward boards, animation and history bounds, key repeats and focus, comparison and clear recovery, edits, interrupted pointers, tab/URL restoration and unchanged discoveries. No model rule, persistent storage, dependency or domain configuration changes.


## Keep exploration results in view

The near-canvas “检查探索” action now scrolls the rendered result itself into view before moving keyboard focus there. A completed check from either location does the same after hiding the check controls. Previously the inline action scrolled to the top of the instruction panel while focusing its last paragraph with scrolling suppressed; at 300% browser zoom, the focused result was entirely below the viewport. A visible keyboard focus outline now identifies the result.

Nonterminal checks beside the instructions retain their button focus and do not force a scroll. Existing reduced-motion scrolling, polite announcements, scientific checks, model state, saved observation URLs and notebook rules stay unchanged. There are no new controls, timers, dependencies or stored state. `tests/mission-result-focus.test.js` covers progress, corrections and completion in all five worlds, rendering before focus, retained sessions, fixed checkpoints and inert inactive checks. Public cloud-browser checks cover the result at ordinary and zoomed layouts; physical touch, device rotation and screen-reader speech remain unverified.


## Keep the first exploration check result

Both exploration Check buttons ignore repeated Enter keydowns. Holding Enter on the upper button now retains the first check's result: a successful baseline reading is no longer immediately replaced by the next step's correction. The checked milestone and recorded baseline were already retained; this protects the visible feedback and its announcement. A separate Enter press still checks the current step, as do native Space, pointer and assistive-style clicks.

The guard adds no timers, held-key state, model changes or storage. Upper nonterminal checks keep button focus without scrolling; inline checks and completion still reveal and focus the rendered result. `tests/mission-check-key.test.js` covers all five experiments, running starts, repeated/corrective checks, completion, native-key defaults, fixed checkpoints, notes, tab/anchor/resize restoration and restarted explorations. Twelve regression cases fail on the previous code; the ordinary-input case passes before and after. The original feedback replacement was reproduced with native held Enter in the public cloud browser. Physical touch, device rotation and screen-reader speech remain unverified.


## Reach the notebook after a discovery

A completed exploration now offers “查看与保存本次发现” immediately after its result. This native link opens the existing discovery notebook, where visitors can review, download TXT or select text for manual copying. The adjacent description warns that findings live only in the current page and disappear on refresh. Clicking the link does not itself save or copy anything.

The route appears only for the current completed exploration, follows its retained state across tab returns, and hides on restart or a genuinely different URL. Historical notes remain intact. Result focus and its existing announcement stay unchanged; the next Tab reaches the link. The link uses the already named, focusable notebook section and existing native anchor/history behavior. It wraps with a 44-pixel target and a visible keyboard focus ring, with no new live region, model changes, storage, download logic or dependencies.

`tests/mission-notes-route.test.js` covers every experiment and both check locations, incomplete checks, repeated completion, restart, tab returns, fixed checkpoints, running-state preservation, native fragments, URL invalidation, and responsive/accessible markup. Public cloud-browser checks cover the completed-result-to-notebook path and zoomed layout; physical touch, device rotation and screen-reader speech remain unverified.


## Return to a fixed shared observation

Wave, Fractal and Walk now show a quiet description of the current link’s saved moment, plus “回到链接中的观测”. The action rebuilds that same probe/time, seeded point count or seeded step count and pauses, then reveals and focuses the canvas. It does not reload the page, rewrite the fixed URL, change other worlds, restart an exploration or erase earned notebook entries. A nearby warning explains that the current canvas is replaced. An opened observation link offers the same return even before it is copied. Parameter-only or invalid links offer no misleading return action.

The destination comes from the existing validated URL checkpoint, with no extra model archive or persistent storage. Ordinary running, stepping, reset and tab return retain it; changing parameters, presets or guided starts clears it as before. Sharing again explicitly records the new moment. Return clears obsolete copy feedback and ignores a late clipboard result; repeated Enter cannot trigger repeated returns or edit the newly focused canvas.

`tests/saved-observation-return.test.js` covers exact replay and subsequent deterministic steps, running interruptions, caps, resize, tab/history restoration, invalid links, replacement invalidation, active and completed discoveries, other-world preservation, native key behavior and responsive/accessible markup. Hardware touch, device rotation and screen-reader speech remain unverified.

## Inspect a Life comparison without undoing it

An active one-generation Life comparison now has a native “查看画布中的这一代” link beside its result. It reaches the existing paused canvas while retaining the birth/death overlay. A companion link under the canvas returns to the focusable comparison result, where “返回修改” keeps its separate meaning of restoring the original board. Previously the result described the offscreen overlay but offered no direct route to see it; the adjacent Return action removed it.

The routes appear only while a comparison exists and hide when it ends, including after editing, stepping, continuing, rewinding or loading another start. Tab returns and Clear undo restore them with the retained comparison. Anchor navigation, rate/density adjustments and resizing keep the board, generation, selected cell, history and discovery notes intact. Native Back/Forward works without replaying the comparison; sharing retains the reading fragment but Life links remain parameter-only. There are no new model rules, live regions, timers, storage or dependencies.

`tests/life-comparison-route.test.js` covers changed and unchanged trials, native semantics, two-way anchor history, all trial-ending actions, tab/clear restoration, running starts, share limits and notebook boundaries. The links use wrapping 44-pixel targets and a visible result focus outline. Physical touch, device rotation and screen-reader speech remain separate verification limits.


## Erase a Life stroke without clearing the board

Life's near-canvas “拖动擦除” toggle switches connected pointer strokes between lighting and erasing cells. The adjacent quiet text names the current tool, and the native button exposes its pressed state. Both ends and every interpolated cell use the chosen value, so fast or repeated erasing strokes leave no gaps or accidental toggles. The default remains ordinary drawing. Taps, Enter/Space and the precise single-cell button still toggle their selected cell; this drag-only scope is stated beside the control.

Choosing the tool changes no cells, history, comparison, checkpoint, discovery or pause state. It cancels any unfinished gesture before switching, so a delayed pointer release cannot use the new tool on an old path. Actual drags pause and follow the existing capture, coordinate, interruption and stale-click rules; editing clears stale comparisons and Clear recovery as before. Clear undo can restore the resulting edited board without changing the chosen tool. Held Enter selects the tool only once.

The choice remains in page memory through tab switches, resets, presets, guides and URL restoration; a fresh page defaults to drawing. It is not included in shared links or notebook entries. The wrapping 44-pixel control adds no model rule, archive, animation loop, persistent storage or dependency. `tests/life-drag-eraser.test.js` covers connected paths, sparse/final samples, edges, repeated erasing, tap and keyboard preservation, tool changes during a gesture, interruption, recovery, state isolation and native semantics. Public cloud-browser checks cover pointer strokes, keyboard selection and zoomed layout; physical touch, device rotation and screen-reader speech remain separate verification limits.


## Undo while staying on the Life canvas

When Life's canvas has keyboard focus, Ctrl+Z (Command+Z on Mac) now restores the same last drawing edit as “撤销上一笔”. The canvas retains focus, so visitors can immediately move the selected cell or draw again without navigating through the intervening controls. The existing single recovery handles a tap, keyboard/precision toggle or entire drawing/erasing stroke; this shortcut adds no extra snapshot, redo or history. The visible recovery guidance describes the shortcut, and the Life canvas exposes its keys and associated description to assistive technology. Other worlds clear those associations.

The handler is attached only to the canvas, leaving text fields and the rest of the page's shortcuts alone. Shift+Z redo combinations, Alt-modified input and composition events are untouched. A held shortcut does not repeat; unavailable undo causes no redraw, pause or announcement. Cancellation, comparison/history restoration, saved links, notebook boundaries and recovery expiry use the existing action unchanged. `tests/life-undo-shortcut.test.js` covers these paths alongside Control/Meta, Caps Lock, retained sessions and continued keyboard drawing. Public cloud-browser checks supplement deterministic event tests; a physical Mac keyboard, hardware touch and screen-reader speech are not established by these tests.

## Browse without changing a Life drawing

Life's focused canvas now leaves Shift-modified navigation to the browser, matching the other four experiments. In particular, Shift+Space can scroll back up the page without toggling a cell, discarding a comparison or replacing the last drawing recovery. Shift+arrows and Shift+Enter likewise leave selection, animation, pointer gestures, history, shared parameters and earned notes untouched. Plain arrows, Enter and Space still edit normally; Ctrl/Command+Z retains its existing canvas-only undo.

The fix adds only the missing modifier guard, with no new controls, state, timers or dependencies. `tests/life-browser-keys.test.js` covers running and paused boards, repeated keys, modifier combinations, comparison and Clear recovery, pointer continuity, retained sessions and discoveries. Eleven cases fail on the previous code. The original Shift+Space collision was reproduced in the public cloud browser; native scrolling after the fix is checked there separately. Hardware touch, physical simultaneous input and screen-reader speech remain unverified.


## Recognize worlds with earned discoveries

The compact five-world selector now keeps a checkmark beside each world that has a recorded discovery. Previously the phone layout hid its full badge and left only a border-color difference. The existing badge also supplies the tab's accessible description, while the concise world name, selected state and keyboard navigation remain unchanged. It is available even when the full badge is hidden by the compact layout. The checkmark lives inside the already decorative short label, so it adds no duplicate spoken label.

The status comes from completed notebook entries, not the currently active exploration. It appears only after a successful final check, survives tab changes, restarts and URL-based mission replacement, and clears on a fresh page along with the notebook. There are no new controls, Tab stops, live regions, model changes, persistent storage or dependencies.

`tests/discovery-badges.test.js` covers all five verified completions, incomplete and standalone comparisons, historical retention, fresh-page clearing, unchanged tab semantics, fixed observations and quiet animation. Public cloud-browser checks cover accessible associations and visible compact navigation at ordinary and zoomed layouts; physical touch, rotation and screen-reader speech remain unverified.


## Replay Fractal without leaving the canvas

With the Fractal canvas focused, Left Arrow now rewinds exactly one seeded point and Right Arrow adds it back. Both directions reuse the existing replay actions, pause on a successful step and keep canvas focus, so visitors can inspect a jump in both directions without tabbing to another control. The canvas hint, accessible key shortcuts and existing nearby help describe the pair. Other worlds retain their own keys.

Holding either key still performs only one action, and modified arrows retain browser defaults. The existing 300–12,000 point bounds, exact seed/ratio replay, fixed shared checkpoints, tab memory, parameter resets and explicitly checked discoveries remain unchanged. An unavailable action does not redraw, announce or interrupt animation. No extra controls, timers, model archives, storage or dependencies are introduced.

`tests/fractal-canvas-replay.test.js` covers exact drawing restoration at several seeds and ratios, button equivalence, focus, running interruption, key repeats, modifiers, boundaries, tab/resize/history restoration, checkpoint integrity and notebook behavior. The public cloud browser reproduced the old one-way keyboard behavior before the change. Physical touch, hardware keyboards on other operating systems and screen-reader speech remain separate verification limits.


## Inspect one Life generation per Enter press

Life’s “下一代 +1” button now ignores repeated Enter keydowns, so holding the key preserves the first next-generation board and its readings instead of skipping through many generations. A fresh Enter press advances once again; native Space, pointer and assistive-style clicks keep their existing activation. This matches Life’s existing one-press rewind and editing controls. Other worlds retain their primary-step repeat behavior, including Fractal’s 100-point and Walk’s 16-step batches.

The guard runs before the native click, leaving running boards, interrupted drawing gestures, comparisons, recovery snapshots and history unchanged when only a repeated key arrives. It adds no held-key state, timer, control, model rule, storage or dependency. Actual steps still pause, clear expired recovery and follow the existing deterministic rules. Saved parameter links, retained sessions and explicitly earned discoveries stay intact.

`tests/life-step-key.test.js` covers glider, blinker and pulsar transitions and exact rewinds; running starts; repeated input with comparisons, recoveries and unfinished strokes; sharing, tab/history/resize restoration; notebook boundaries; native defaults; and unchanged other-world batches. Eight regression cases fail on the previous code. The original public cloud-browser behavior advanced from generation 1 to 16 during one native held-Enter input; the corrected behavior is checked after publication. Physical touch, other operating systems’ hardware keyboards and screen-reader speech remain unverified.


## Read the Wave field at a known scale

The Wave canvas now includes a compact model-unit ruler, with the same reading in quiet text beside the field. Its line uses the exact CSS-pixel scale shared by the wave field, sources and probe. A readable 1/2/5 length adapts to ordinary layouts and wide saved observations. The ruler makes apparent spacing comparable when resizing or returning to a fitted checkpoint; its help explicitly distinguishes view scaling from changed model parameters or probe coordinates.

A dark backing keeps the label legible over both wave colors. The ruler is painted above measuring paths to protect its label; sources and the probe are painted afterward, keeping corner markers visible. It is included in canvas snapshots, appears only in Wave, and updates without extra live announcements or repeated unchanged text writes. There are no new controls, timers, model rules, persistent state or dependencies.

`tests/wave-scale.test.js` checks exact labelled lengths at ordinary and extreme checkpoint scales, responsive resizing, parameter and phase changes, center/reset recovery, animation, tab returns, fixed links and earned discoveries. All eight new cases fail on the previous code. Public cloud-browser checks cover the visible ruler and quiet text at ordinary and zoomed layouts; hardware touch, rotation and screen-reader speech remain separate verification limits.


## Compare the whole walk ensemble beside the canvas

The 16/64-step comparison now keeps the whole group's measured and theoretical spread beside its existing buttons, above the separate white-walker distance reading. Visitors can compare the relevant numbers while watching the point cloud, including with the instruments closed on narrow screens. The quiet text uses the same centered sample spread and population theory as the detailed observations below; drift from the origin and one walker's distance are not substituted for spreading. Nearby help explains the point-cloud center and finite-sample variation.

The reading reuses already computed statistics, follows animation, exact replay, parameters, resets, presets, saved observations and retained tabs, and skips unchanged text replacements. It introduces no controls, extra live announcements, model rules, state, timers, storage or dependencies. Discoveries still require an explicit successful check.

`tests/walk-spread-reading.test.js` covers 16/64 comparison, biased/seeded moments, exact replay and bounds, quiet animation, unchanged redraws, responsive restoration, fixed checkpoints, parameter changes and notebook boundaries. All eight new cases fail without the new reading. Public cloud-browser checks cover real controls, accessible text and zoomed layouts; physical touch, rotation and screen-reader speech remain separate verification limits.

## A fixed central reference for the fractal comparison

The fractal canvas outlines the triangle joining the three side midpoints with a thin pale-blue dashed line. Its geometry is fixed when the seed or jump percentage changes. The quiet reading beside “比较 1,000 点” reports how many of the currently displayed samples are strictly inside that reference area, using the same boundary tolerance as the measured discovery check. For seed 14 at 1,000 points, half-jumps leave 0 interior points; 38% jumps leave 285. The denominator always follows the live sample count. This is a finite-sample observation, not a claim that other jump percentages share the half-jump attractor or its dimension.

The outline neither fills the region nor changes the random sequence. Reading and outline follow replay, growth, resets, presets, parameter edits, fixed observation returns, history and retained tabs. Unchanged text is not replaced, animation adds no live announcements, and discovery completion still requires an explicit successful check. No controls, dependencies, timers or persistent storage were added.

`tests/fractal-gap-reading.test.js` covers measured overlap versus empty half-jumps, matching geometry at narrow and wide layouts, excluded boundary samples, exact replay and limits, quiet updates, parameter and preset changes, checkpoint/history restoration, and notebook integrity. Physical touch, device rotation and screen-reader speech remain separate verification limits.


## Identify the Orbit measurement on the canvas

A white diamond marks the same first planet measured by the Orbit exploration and observation panel. While paused, a thin solid segment measures its distance from the center; the orange dashed ten-second preview and hollow launch marker retain their separate meaning. A quiet radius/speed reading now sits beside the canvas, before the existing next-launch controls, so an observer can follow the measured planet without opening instruments or relying on color. The on-canvas legend also appears in PNG snapshots and is painted above trails.

The diamond follows the actual body at a constant screen size. A planet that leaves the view is not clamped or replaced by an edge marker: its numeric measurement continues, and both the canvas legend and nearby text say it is outside the view without calling that escape. Animation keeps the identity marker and quiet numbers but hides the radial line; Pause, manual steps, presets, guides, tab returns, reduced motion and resize refresh the same current model. Adding planets or changing the next-launch speed never changes which body is measured.

No controls, model rules, camera behavior, timers, state, persistence or dependencies are added. Parameter-only Orbit links and explicitly checked discovery notes retain their existing limits. `tests/orbit-measurement.test.js` covers exact first-body readings and geometry, weakened-gravity progression, added bodies, offscreen behavior, scale and retained views, quiet animation, unchanged text writes, presets, history, reduced motion, launch limits and notebook integrity. Public cloud-browser checks supplement these deterministic tests; hardware touch, device rotation and screen-reader speech remain separate verification limits.

## See which Life neighbors decide the next generation

While Life is paused, eight hollow dashed frames identify the cells counted around the selected solid orange frame, including diagonal neighbors. At an edge or corner the frames wrap to the actual cells on the opposite side. The selected cell is excluded. Dark strokes over live fills and light strokes over empty cells keep the hollow dashed frames legible without using color as the identifying cue. Existing live-cell fills remain visible; the comparison's solid birth frames and death crosses are drawn above the neighbor guide and retain their separate meaning.

The current cell's next-generation outcome and rule now sit beside its existing position/count reading, before the collapsed instruments. Both reuse the same model-derived inspection, and the nearby help explains simultaneous updates and connected edges. They stay quiet, skip unchanged text writes and add no control or live announcement. Running hides the neighbor frames, while Pause, reduced-motion and initial pointer contact refresh them without advancing the board. Life still redraws once per generation during animation.

`tests/life-neighbor-context.test.js` covers all alive/dead neighbor counts against actual steps, all corners and edges, narrow and fractional view sizes, animation, comparison-layer order, recovery and rewind, presets, history, retained tabs and notebook integrity. Existing recovery and render-count assertions account for the paused overlay. No model rule, random sequence, snapshot archive, timer, persistent storage or dependency changes. Public cloud-browser checks supplement deterministic tests; hardware touch, device rotation, physical simultaneous input and screen-reader speech remain separate verification limits.

## Keep Wave measuring markers visible over bright peaks

The existing A/B source dots, source letters and hollow probe now have opaque dark outlines beneath their light foregrounds. This keeps the measuring markers readable as the field changes from dark zero crossings to bright yellow-green peaks, without filling the probe or covering large areas of the wave pattern. They remain above the measuring paths and ruler, and appear in canvas snapshots. Source/probe positions, dot and ring radii, crosshair arms and label anchors are unchanged; the two sources can still visually overlap in a very distant fitted view.

The isolated drawing helper restores its canvas styles and explicitly uses solid strokes. No controls, messages, simulation rules, parameter ranges, random sequences, state, timers, storage or dependencies change. `tests/wave-marker-contrast.test.js` checks the backing/foreground order and contrast, exact geometry, quarter-cycle changes, cancellation points, narrow and fitted layouts, quiet animation, reduced motion, presets, checkpoint/history/tab restoration and notebook integrity. Existing field-color tests continue to compare every rendered sample with the model. Public cloud-browser checks supplement these deterministic tests; hardware touch, rotation, physical simultaneous input and screen-reader speech remain separate verification limits.

## Keep the walk ruler useful as the view zooms

The Walk canvas now chooses a labelled 1/2/5 ruler length from its actual view scale, keeping the bar between 32 and 80 CSS pixels instead of letting a fixed ten-step bar shrink to a few pixels during long biased walks on narrow screens. End ticks make its two endpoints clear. The same unit still means one lattice move; walker positions, paths, theoretical circle, camera fit and all model readings are unchanged. The ruler is included in canvas snapshots.

A quiet wrapping text equivalent below the canvas identifies the current ruler length and explains that resizing the view does not move the walkers. It changes only when the displayed units change, introduces no control or live announcement, and follows animation, replay, checkpoints, parameter changes, retained worlds and resize. `tests/walk-scale.test.js` verifies the ruler against the independently seeded ensemble, narrow and wide layouts, changing drift, exact replay, state preservation, unchanged text writes, limits and discovery notes. Public cloud-browser checks supplement deterministic tests; hardware touch, rotation and screen-reader speech remain separate verification limits.

## Explain Wave paths beside the probe

The existing precision probe now shows the path difference divided by wavelength and the resulting interference classification beside its coordinate/amplitude reading. A nearby key identifies paused solid A and dashed B paths, and explains integer versus half-integer wavelength differences and the existing 0.1-wavelength “near” threshold. Visitors can move between center, mixed and cancellation locations without scrolling away from the controls or opening instruments. The full component readings remain available in the instrument drawer.

The classification uses the same unrounded geometry and shared labels as the observation panel. Display rounding does not determine the threshold. Quiet text updates only when its contents change, so phase-only stepping or animation does not rewrite the comparison or add announcements. Probe movement, parameter/preset changes, guides, shared observations, history, retained tabs, reduced motion and view resizing keep it current. It adds no controls, model changes, timers, persistence or dependencies and does not record a discovery without an explicit successful check.

`tests/wave-path-context.test.js` covers center/mixed/cancellation states, both sides of classification boundaries, source and far-checkpoint geometry, exact input paths, quiet phase-only updates, resets and presets, shared/history/tab restoration and notebook integrity. Public cloud-browser checks supplement deterministic tests; hardware touch, device rotation and screen-reader speech remain separate verification limits.


## Read Orbit distances at a known scale

A compact lower-left model-unit ruler now connects Orbit's measured distances to its canvas. The labelled 1/2/5 interval stays 32–80 CSS pixels long as the viewport or retained launch view changes. A quiet text equivalent beside the existing first-planet reading identifies the current interval and the four concentric-ring radii (50, 100, 150, 200), and explains that view scaling does not change physical distances. No new control or live announcement is added.

The ruler uses the same transform as the planets, launch point and preview. Its dark backing is painted after trails and the radial measuring line, keeping the label readable; all planet dots, the first planet's identity diamond and the launch marker are painted afterward. This only separates their existing drawing layers. Model positions, speeds, time, view fitting, random sequences, sharing and discovery checks are unchanged. The scale appears in canvas snapshots and follows animation, resize, retained tabs, reset, presets, guides and URL restoration.

`tests/orbit-scale.test.js` verifies exact units, tick and text size, default and fitted views, pointer-selected corners, narrow/fractional layouts, quiet redraws, drawing-layer order, recovery paths, parameter-only sharing and notebook integrity. Public cloud-browser checks complement those deterministic tests; hardware touch, rotation and screen-reader speech remain separate verification limits.


## Keep Walk measurement anchors visible inside the point cloud

The paused origin ring now sits above the 256 walker dots, rather than underneath them. A compact opaque dark edge separates that hollow ring, the existing orange sample-centroid cross, the white representative walker and the origin label from bright points and overlapping paths. Measurement shapes are painted above the label so a nearby tracked point remains identifiable even when view fitting brings them together. Their model coordinates, screen-size geometry, colors and label anchor are unchanged. The ring still appears only while paused; the centroid, tracked walker and label remain available during animation. Exact coincident positions remain coincident, rather than moving a marker to suggest a false measurement.

This is an isolated canvas-layer and contrast change. It adds no controls, text, live announcements, simulation rules, view fitting, timers, storage or dependencies, and appears in canvas snapshots. `tests/walk-marker-contrast.test.js` checks drawing order, contrasting edges, all marker positions against an independently seeded ensemble, origin returns, narrow and fractional layouts, exact replay, animation and reduced motion, presets, saved observations, history, retained tabs and notebook integrity. Public cloud-browser checks supplement these deterministic tests; physical touch, device rotation and screen-reader speech remain separate verification limits.

## Read Fractal guides over dense samples

The fixed central reference, paused full-jump dashed guide, travelled segment and new landing point now have narrow opaque dark edges beneath their existing colors. This keeps the measuring geometry identifiable over dense yellow-green sample points, especially at the 12,000-point limit with overlapping 38% jumps. The backing follows each existing dash pattern rather than filling its gaps. The central region stays unfilled; the previous-point hollow circle, target-vertex ring, all coordinates and screen-size radii are unchanged. Exact coincident points remain coincident.

These canvas-only strokes preserve the seeded sequence, camera fit, point cloud, readings, replay, animation, saved observations and explicitly checked discovery notes. They appear in canvas snapshots without adding controls, messages, timers, persistent storage or dependencies. `tests/fractal-guide-contrast.test.js` checks matching backing/foreground paths, nominal color contrast, every seeded sample, narrow and fractional layouts, replay limits, quiet animation and reduced motion, presets, parameters, history, checkpoints, retained worlds and notebook integrity. Public cloud-browser checks supplement deterministic tests; physical touch, device rotation and screen-reader speech remain separate verification limits.

## Keep keyboard focus after saving a canvas

PNG Save now stays focusable while the captured canvas is being encoded. It exposes its temporary unavailability and busy state through ARIA, keeps the existing visible progress message, and rejects duplicate activations until encoding finishes. Native disabling previously moved keyboard focus to the page body in the public browser. Completion or failure never moves focus, including when the visitor has already selected another control or world.

A held Enter saves only once, even if encoding finishes before the next repeated keydown. Fresh Enter presses, native Space activation, pointer input and retries remain available. Filenames and feedback retain the originally captured world; saving does not pause or modify a simulation, checkpoint or discovery. No new control, live region, timer, storage or dependency is added.

`tests/snapshot-focus.test.js` covers focus retention, delayed completion without focus theft, synchronous and asynchronous failure/retry, rapid repeated activation, held Enter, all five running worlds and both progress caps. Existing snapshot tests continue to cover captured filenames, visible feedback and resource cleanup. Public cloud-browser keyboard checks supplement the modeled focus-loss regression; physical touch, key-repeat timing on real hardware and screen-reader speech remain separate verification limits.

## Keep contact-copy recovery in its place

The footer Copy button stays focusable while clipboard permission is pending, exposes its busy/unavailable state and ignores duplicate activations. An immediate failure still selects the visible contact for manual copying when focus remains on Copy. If the visitor has moved to the canvas, a parameter, another tab or the contact text itself, a late failure only updates the existing feedback: it does not pull focus back to the footer or replace their manual selection. A fresh retry remains available; held Enter copies only once, while fresh Enter, native Space and pointer clicks retain their behavior.

`tests/contact-focus.test.js` covers pending focus and duplicate guards, immediate missing/rejected/throwing clipboard recovery, delayed success and denial after moving away, selection preservation, retries, held Enter and all five running worlds. The contact text, simulation state, checkpoints and discoveries are unchanged. No permission is requested proactively and no timer, storage or dependency is added. Public cloud-browser checks cover ordinary keyboard copy and layout; delayed-denial behavior is verified with controlled test promises, while screen-reader speech and real-device input remain unverified.


## Keep the first preset from a held Enter

The quick replacement button now ignores repeated Enter keydowns, matching the adjacent explicit Load button. One press produces one fresh Life random board or advances to one preset in Orbit, Wave, Fractal and Walk. Holding Enter no longer immediately discards that board or cycles through several seeds. Fresh Enter presses, native Space activation, pointer input and assistive-style clicks retain their existing behavior.

The guard runs before the native click and adds no held-key state, timer, control, model rule, storage or dependency. An ignored repeat does not cancel drawing, alter recovery or comparison snapshots, reset running progress, replace a shared checkpoint or disturb discoveries. Intentional replacements retain their existing effects and pause state.

`tests/preset-key.test.js` covers exact random sampling, all five worlds, running progress, Life recovery and interrupted drawing, capped shared checkpoints, tab/resize/history restoration, notebook integrity and native activation defaults. The public cloud browser reproduced the original defect: one 1.2-second Enter hold on Walk advanced its seed from 15 to 20 while cycling presets. Post-publication browser checks verify one replacement per hold; physical hardware repeat timing, touch and screen-reader speech remain separate verification limits.


## Keep a Life stroke owned by its first pointer

A pointer press that is rejected while another Life stroke is active now also suppresses that pointer's later click. The same existing bounded, pointer-specific guard handles secondary touches and another device's concurrent primary pointer. A rejected click can no longer interrupt the original drawing, toggle a different cell, or replace the whole-stroke undo with a one-cell recovery. The guard remains valid after the owning stroke ends, a command runs, or another experiment opens.

A new accepted press clears only its own stale guard, keeping recycled pointer IDs and ordinary taps usable. Keyboard-style clicks and the owning pointer's tap retain their existing behavior. No additional state, timer, control, model rule, storage or dependency is introduced. Legacy clicks without a pointer ID continue to follow the last accepted pointer sequence; they cannot identify an arbitrary out-of-order rejected pointer.

`tests/pointer-ownership.test.js` covers active ownership, both delayed-click orders, mixed device types, preserved drawing/clear recovery, comparisons and discoveries, cross-world interruption, fresh and recycled pointers, keyboard-style clicks, legacy accepted taps and bounded suppression. Ten new cases fail on the previous code. The event model follows the [W3C Pointer Events specification](https://www.w3.org/TR/pointerevents3/#the-click-auxclick-and-contextmenu-events). These deterministic event tests do not establish which simultaneous hardware sequences a particular browser emits. Public cloud-browser checks cover ordinary drawing, tap, undo and cross-world operation; physical multi-touch, mixed-device timing, rotation and screen-reader speech remain unverified.

## Keep the selected Life cell visible

The orange selected-cell frame now has a dark backing, so it remains distinguishable over bright living cells as well as empty cells. The previous orange/live-fill nominal sRGB contrast was about 1.46:1; the dark edge contrasts with orange at about 7.94:1 and the live fill at about 11.56:1. This is a canvas rendering improvement, not a claim about all display pixels or assistive technology.

The same hollow rectangle is drawn at the same cell coordinates, above the neighbor and comparison overlays. Its strokes become thinner in narrow cells, keeping at least one CSS pixel of the live/dead interior at supported layouts rather than covering the selected cell. It retains the live/dead fill inside, the orange selection meaning, and the separate dashed neighbor context. The helper restores its drawing styles and uses solid strokes. There are no new controls, messages, model rules, input semantics, timers, storage or dependencies; the outline also appears in canvas snapshots.

`tests/life-cursor-contrast.test.js` covers identical backing/foreground geometry, live and empty cells, board edges, narrow and fractional layouts, pointer drawing and erasing, undo, generation replay, comparison layers, quiet animation, reduced motion, presets, retained tabs, parameter-only sharing, history and discovery notes. Seven rendering regression cases fail on the previous code; the color calculation passes before and after. The neighboring-marker test identifies its dashed frames explicitly. Public cloud-browser checks supplement these deterministic checks; physical touch, device rotation, simultaneous hardware input and screen-reader speech remain unverified.

## Find keyboard focus on light and dark surfaces

Keyboard focus now uses a dark terracotta ring on light page, parameter, note and guidance surfaces, with a light peach ring on the dark canvas and instrument areas. Both pale control rows inside the dark stage reset to the light-surface color. The existing three-pixel outlines, offsets, inset compact-tab/range outlines, layout and focus behavior are preserved. Because the full-width canvas borders both dark and pale areas, its outside ring also has an opaque dark backing, extending two pixels beyond the ring; it is painted above neighboring panels only while keyboard focus is visible and does not change the canvas box or saved image.

The former shared orange ring had nominal sRGB contrast of about 2.29:1 against the page and 2.02:1 against an active lime tab. The dark ring now measures about 6.70:1 and 5.92:1 there. The existing faded states also remain distinguishable: the pending contact Copy ring measures about 3.18:1 and unavailable Life Undo about 3.43:1 after their existing opacity is composited against the surrounding surface. The change adds no control, motion, live announcement or simulation behavior. These are defined-color checks, not an overall accessibility conformance or display-pixel claim; system forced colors remain free to override authored colors.

`tests/focus-contrast.test.js` checks the palette, relevant surrounding surfaces, the two faded states, dark-container inheritance, both pale stage exceptions, all authored outline selectors, unchanged outline geometry and the canvas-only backing. Public cloud-browser keyboard and zoom checks supplement these static checks. Screen-reader speech, physical touch and operating-system forced-color rendering remain separate verification limits. The contrast reference is [W3C's explanation of non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).


## Inspect one Wave quarter-cycle per Enter press

The Wave quarter-cycle button now ignores repeated Enter keydowns. A fresh press still pauses at the current time and advances exactly one quarter cycle; releasing and pressing again inspects the next phase. This preserves the nearby two-step sign reversal and four-step full-cycle comparison. A held key previously skipped phases rapidly: the public cloud browser advanced from 0.5 s to 8.4 s during one 1.2-second hold. Native Space activation, pointer and assistive-style clicks, probe movement, Life's one-generation guard and the other worlds' repeatable batch controls retain their behavior.

The existing keydown guard is extended only to Wave. No control, message, timer, held-key state, simulation rule, saved observation, dependency or persistent storage is added. `tests/wave-step-key.test.js` covers exact center/cancellation/mixed/fitted-checkpoint phases, running and reduced-motion states, repeated-only input, fresh presses, native defaults, shared observations, resize/history/tab restoration, parameters, reset/presets, discoveries and other-world behavior. The old Life test now scopes its repeatable-world assertion to Orbit, Fractal and Walk. Public cloud-browser checks complement deterministic event tests; physical keyboard repeat timing, touch, device rotation and screen-reader speech remain unverified.


## Refuse incomplete observation links without losing the saved moment

Sharing now checks that the entire current observation fits the existing bounded URL format before changing the address, pausing, selecting a link or accessing the clipboard. A valid extreme Wave checkpoint can move outside the coordinate limit or advance past the time limit. Previously Share then silently dropped the observation, copied a parameter-only URL, and still promised exact paused replay.

An unsupported observation now gets an explicit message in the existing sharing status: no new link was generated or copied; the visitor can save an image or reset before sharing again. The current model, running state, previous link and selection, saved observation and its return action remain intact. Any older pending copy result cannot replace this newer message. Returning to a supported observation, centering an out-of-range probe or resetting an out-of-range clock makes normal sharing available again. Inclusive URL bounds and all simulation rules remain unchanged; there is no new control, storage, timer or dependency.

`tests/share-integrity.test.js` covers keyboard, precision and pointer movement, narrow and fractional layouts, time stepping and running overflow, boundary round-trips, saved-link and selection preservation, stale copy completions, recovery, resize/history/tab restoration, discoveries and ordinary sharing in all five worlds. The public cloud browser reproduced the original misleading link. Post-publication UI checks cover visible feedback, checkpoint retention and ordinary recovery; controlled tests cover delayed clipboard results. Physical touch, device rotation and screen-reader speech remain separate verification limits.


## Keep unchanged stage readings in place

The main canvas readout now reuses its existing text node whenever its displayed value is unchanged. Orbit and Wave still render and calculate every animation frame, but their one-decimal clocks only replace DOM text when the visible tenth changes. A controlled 120-frame, two-second run previously made 120 readout replacements per world; it now makes 20, with exactly the same clock text and simulation frames. This is a reduction in counted text writes, not a measured browser frame-rate or battery claim.

Life, Fractal and Walk use the same existing compare-before-write helper. Cursor/focus-only redraws and resizing keep identical readings in place; editing, stepping, replay, presets, parameter changes, saved observations and retained-world navigation still refresh the exact current reading. The helper compares the actual DOM text, so it also repairs a stale value without a separate cache. No layout, model, timing, announcement, state, control, dependency or storage changes are introduced.

`tests/metrics-writes.test.js` covers both animation clocks, all five paused/resized/focused worlds, stale-value repair, Life editing/recovery/generation counts, capped checkpoints, replay, retained worlds, presets, parameters and extreme Wave time. Eight regression cases fail on the previous code; the cross-world content compatibility case passes before and after. Public cloud-browser checks verify the displayed readings and ordinary controls; physical touch, rotation, screen-reader speech and browser performance remain unmeasured.

## Follow display density without resetting an experiment

A canvas now refreshes its backing resolution when display density changes even if its CSS width and height stay the same, such as moving a paused experiment between monitors. Previously only a canvas layout resize refreshed the density; a 600×414 canvas initialized at 1× therefore stayed at 600×414 after a density-only move to 2×. It now redraws at 1200×828 while preserving the same CSS-space drawing and measurements.

One re-armed resolution media-query listener watches the current raw density. The existing 2× rendering cap remains: a 2×→3× change re-arms the listener without an unnecessary redraw, while a later return to 1× is still detected. There is no polling, new animation chain, model change, persistent storage or dependency. Current positions, seeded progress, Life drawing/undo/history, focus, pause state, saved observations and reduced-motion behavior remain intact.

`tests/canvas-density.test.js` exercises all five paused worlds at unchanged CSS sizes, fractional densities, initial high-density displays, repeated monitor changes, listener cleanup, capped transitions, unchanged edge-probe views, regular resizing, running-state continuity, Life strokes and replay, retained worlds and saved observations. Nine density regressions fail on the previous app; all eleven cases pass with the listener. Public browser zoom checks supplement the deterministic tests; physical multi-monitor switching and device rotation remain unverified. The event-driven approach follows [MDN's devicePixelRatio monitoring guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes).


## Recover a canvas without losing the experiment

If the browser loses and restores the canvas's 2D backing store, the current experiment now repaints immediately, including when paused. Restoration also reapplies the current capped display-density transform. Previously a paused canvas stayed blank until another action redrew it, and a high-density running canvas could draw with the reset, unscaled context.

During a reported context loss the animation frame chain stops. Recovery resumes only when the visitor's current pause choice, page visibility, stage visibility and reduced-motion behavior already allow it, without advancing through the missing time. An active Life stroke ends at the interruption; its partial drawing, one-step undo and trailing-click protection survive. Parameters, model state, fitted edge views, focus, saved observations and discovery notes are preserved. Changes explicitly made with controls while the context is unavailable remain in effect when it returns.

This uses the browser's `contextlost` and `contextrestored` events and leaves default restoration enabled. There is no polling, new control, dependency, persistent storage or automatic page reload. It can respond only where the browser provides these events; it does not guarantee recovery from permanent graphics failure or a closed/reloaded page. The lifecycle follows the [HTML canvas context-loss specification](https://html.spec.whatwg.org/multipage/canvas.html#context-lost-steps) and [MDN's restoration guidance](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/contextrestored_event).

`tests/canvas-recovery.test.js` uses deterministic context-loss/restoration events with a cleared drawing record and reset transform to cover all five paused/running worlds, density, pending layout, visibility, reduced motion, interrupted drawing, undo, comparison/replay, saved observations and retained worlds. These checks do not induce a physical GPU failure. Public cloud-browser checks cover normal displayed experiments and interactions after deployment; hardware graphics loss, touch, rotation and screen-reader speech remain unverified.


## Avoid empty PNGs while the canvas is recovering

After a reported canvas context loss, “保存这一刻” now explains that the canvas is temporarily unavailable and does not start encoding or downloading a missing bitmap. The existing visible Save feedback and action announcement provide the retry instruction without removing keyboard focus or altering the experiment. Recovery does not queue or automatically download anything; the visitor makes a fresh save when the picture returns. Held Enter repeats remain suppressed.

A PNG requested before the interruption keeps its original capture, experiment name and existing success/failure handling. This follows the [HTML canvas serialization algorithm](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-toblob), which copies the bitmap before asynchronous encoding. A duplicate click during that encoding does not overwrite its pending feedback. No changes are made to rendering, simulation timing, shared observations, discovery notes, controls, storage or dependencies.

`tests/snapshot-context.test.js` covers all five worlds, rejection before encoding, explicit retry after repaint, pending success/failure across a world change, keyboard focus and repeat handling, and Life drawing undo/history/notebook preservation. All 13 regression cases fail on the previous app. Context loss is simulated in these tests; physical graphics failure and receipt of a downloaded file remain unverified.


## Explain a temporary blank canvas without discarding progress

During a reported canvas context loss, the existing stage status now says “画布待恢复” instead of claiming the experiment is running. Its nearby interaction hint explains that the experiment remains in this page while waiting for browser recovery, and warns that refreshing clears progress. The warning stays visible across pause/continue, stepping, parameter changes, presets, discoveries, world changes, history restoration, resizing and display-density changes. Once the canvas returns, the correct current-world hint and current pause status return.

This uses the same readable, wrapping stage text, with no new control, live region, automatic announcement or reload. Current action and PNG feedback, keyboard focus, simulation state and the visitor’s pause choice are preserved. Identical lifecycle notifications reuse unchanged text instead of replacing it. A permanent failure still cannot be repaired by this message; recovery depends on the browser.

`tests/canvas-recovery-feedback.test.js` covers all five running/paused worlds, lifecycle interruptions, retained and addressed observations, commands during loss, quiet feedback and pending PNG completion. Ten regression cases fail on the preceding app; the unchanged readable-markup check passes before and after. Existing canvas-recovery tests now explicitly expect the intentional status transition while retaining their state checks. Context loss is simulated, not an induced hardware failure. Public cloud-browser checks cover ordinary status, hints and controls; physical graphics loss, touch, rotation and screen-reader speech remain unverified.


## See change behind a flat Life population

The population history now includes a quiet reading for the latest recorded generation: newly born cells, cells that disappeared, and cells that stayed alive. A three-cell blinker has two births, two deaths and one survivor even while its population graph stays flat. Equal totals with changed positions, an unchanged populated pattern, and an unchanged empty board are described separately.

The reading compares the two existing board records only when their generation numbers are consecutive. Initial boards and manual edits explain that a next generation is needed; they never invent zero turnover. Rewind, drawing/clear undo, trial return and experiment-tab restoration use the same existing history, so the reading follows the restored transition. No new controls, model changes, live announcements, storage or extra board snapshots are introduced. Unchanged redraws preserve the text node.

`tests/life-turnover.test.js` covers oscillators, still life, extinction, toroidal boundary patterns, exact births/deaths/survivors and population accounting, replay/history limits, edit and reset boundaries, undo, trial return, animation, quiet redraws, density/context recovery, sharing and retained worlds. All 12 cases fail on the preceding app. Public cloud-browser checks supplement the deterministic tests; physical touch, screen-reader speech and graphics loss remain unverified.


## Read whether the measured planet is approaching or receding

The first planet’s distance and total speed now have a quiet, signed distance-rate reading beside them. A positive value means its current velocity points partly away from the center; a negative value means it points partly toward it. The initial planet has a nonzero speed but zero radial velocity, so a visitor can distinguish motion around the center from motion away from it without relying on animation. The reading follows the same white-diamond planet even outside the canvas. It describes the current instant, not whether the orbit will escape.

For position (x, y) and model velocity (vx, vy), the value is (x vx + y vy) / √(x² + y²), derived by differentiating distance. The implementation projects onto the radial unit vector to avoid an unnecessary large intermediate product. At the center no radial direction is defined, so the helper returns an unavailable value rather than inventing zero. Display and direction text both use the same one-decimal rounding, normalize negative zero, and call a displayed 0.0 “close to zero,” without claiming the body stopped or follows an exact circle. Time is the existing model clock, not elapsed wall time. This uses the position/velocity derivative relationship in [OpenStax Calculus Volume 3 §3.2](https://openstax.org/books/calculus-volume-3/pages/3-2-calculus-of-vector-valued-functions); the radial projection is derived here.

Explicit Pause and Step include the reading in the existing action announcement. Animation and redraws stay quiet and identical readings keep their text node. Existing wrapping measurement styles apply on narrow screens; no control, diagram, simulation rule, timestep, state, storage or dependency is added. `tests/orbit-radial-reading.test.js` checks known projections, independent finite differences, rotation, undefined/large inputs, changing gravity, approaching/receding elliptic motion, offscreen planets, identity, exact model continuity, animation, focus, resizing/density, context recovery, retained worlds, history, parameter-only sharing and discovery evidence. Public cloud-browser checks supplement the deterministic tests; physical touch, screen-reader speech, device rotation and graphics loss remain unverified.


## Count the random choices behind a fractal

The existing last-jump instrument now reports how many of the current sequence's first N selections chose A, B and C. With seed 14 at 1,000 points, the counts are 320 / 350 / 330; seed 15 gives 336 / 342 / 322. Visitors can see that the three-way selection rule does not force equal finite totals. Keeping seed and point count fixed while changing only the jump percentage preserves these counts even as the geometry changes. The help distinguishes vertex selections from picture area and does not claim exact statistical independence, mathematically equal probabilities from a finite generator, or monotonic convergence.

Three bounded counters increment at the existing selection, without an additional random draw or a changed coordinate. They include the initial 300 generated points, sum to the current point count, and reconstruct through the existing seeded replay, reset, preset and observation-link paths. Each experiment instance owns its counters. The quiet readout uses existing wrapping instrument styles and preserves its text node on unchanged redraws. It adds no control, chart, live announcement, storage, dependency or change to discovery evidence; the original batch controls remain repeatable.

`tests/fractal-choice-reading.test.js` checks all 99 supported seeds against an independent exact-integer recurrence, hard-coded finite samples, one-counter increments, no-op and cap behavior, batch and ratio invariance, replay, parameter changes, animation, quiet redraws, saved observations, retained worlds, density/context recovery and notebook integrity. Nine new checks fail on the preceding app; the batch/geometry compatibility check passes before and after. Public cloud-browser checks supplement the deterministic tests; physical touch, screen-reader speech, device rotation and hardware graphics loss remain unverified.


## Count walkers hidden in a crowded point cloud

Walk's existing canvas legend now reports the number of occupied model lattice sites and the largest number of walkers sharing one site. The default seed-14, unbiased 16-step cloud contains 256 walkers but only 79 occupied sites, with up to 15 walkers at one site. At 64 steps those figures are 148 sites and at most 9 walkers. Coincident walkers remain distinct; the original point-cloud renderer shows them at the same coordinates. These are exact model-position counts, not a count of separately visible screen dots or an estimate from brightness.

The read-only helper scans the current 256 positions. It does not consume randomness, change a position or path, add model state, or assume that occupied sites must increase on every step. Replay, comparisons, presets, parameter changes and observation links use their existing ensemble. View scaling, density changes and context recovery leave occupancy unchanged. The quiet wrapping reading stays in the existing legend, is hidden in the other worlds and retains its text node on unchanged redraws. No control, live announcement, collision rule, storage or dependency is added; discovery checks and intentional batch-repeat behavior remain unchanged.

`tests/walk-occupancy-reading.test.js` checks every supported seed with several biases and step counts against an independent sorted-position oracle, explicit crowded samples, exact coordinate pairs, fully coincident/distinct populations, no mutation or extra random draws, replay and caps, animation, reset/preset/parameter paths, quiet redraws, retained worlds, scale/density/context recovery, fixed shared observations and discovery evidence. All 11 new checks fail on the preceding code. Public cloud-browser checks supplement these deterministic tests; physical touch, screen-reader speech, rotation and hardware graphics loss remain unverified.


## Compare a whole wave cycle at one probe

The existing Wave instrument drawer now includes three aligned small traces: source A, source B and the displayed average (A+B)/2. At the half-wavelength cancellation probe, both individual curves keep their unit amplitude while the combined curve stays at zero. At the center, all three curves coincide even when the currently sampled displacement passes through zero. Separate rows prevent identical source curves from hiding one another. Row names, a dashed B trace, shared ±1/0 axes and quarter-period ticks supplement color.

These are sampled model curves for the current probe and parameters over t = 0..T, not recorded history. A white cursor and bright marker identify the current phase and displacement. A quiet text reading gives T ≈ 2.094 model seconds and the current fraction of a cycle; the existing numeric displacement readings remain available. The existing quarter-cycle step moves through the same curves. Changing the probe, wavelength or separation recomputes the fixed curves. The single-entry geometry cache holds 65 samples per row and performs no phase-only resampling. This uses the same sinusoidal contributions and normalization as the field, consistent with [OpenStax's superposition explanation](https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves).

The graph follows the existing canvas clock and visibility rules: when the canvas leaves the screen, both the simulation and cursor stop advancing. Nearby help explicitly describes this behavior. It does not start a separate animation, advance time, consume randomness, add controls, change the field or store observations. Unchanged redraws preserve graph attributes and text; hidden worlds, fixed observation links, discovery evidence and reduced motion retain their existing behavior.

`tests/wave-cycle-trace.test.js` checks exact sample agreement across supported geometry, extreme shared probes/time, analytical cancellation versus a dark instant, periodic cursor wrap, cache reuse/invalidation, quiet repeated redraws, stepping, animation and interruptions, parameters/presets, retained worlds, sharing/replay and discovery notes. Public cloud-browser checks supplement the controlled tests. Physical touch, rotation, screen-reader speech, hardware graphics failure and downloaded-file receipt remain unverified.


## See the measured planet's current direction while paused

Orbit's white-diamond first planet now has a blue direction arrow while paused. It follows that planet's current velocity, so at the initial position the arrow is perpendicular to the distance line even though the radial-rate reading is zero. This distinguishes motion around the center from motion toward or away from it. The orange launch arrow and dashed ten-second preview still refer only to the next planet.

The arrow has a fixed CSS-pixel length, explicitly described as direction rather than speed in both the nearby quiet help and the existing single-line canvas legend, whose opaque footprint is unchanged. Its dark casing keeps the light-blue stroke visible across bright planets, trails and distance lines. The existing numeric speed remains the magnitude reading. Resizing, display density and a fitted launch view do not change the direction or model. An offscreen measured planet has no edge-clamped arrow; a direction that extends beyond the canvas is naturally clipped. Zero or non-finite velocity produces no invented direction. Running hides the cue, and pausing or stepping shows the current vector without a new animation, control, model state, dependency, storage or announcement.

`tests/orbit-motion-arrow.test.js` checks tangential motion, every velocity quadrant, inward/outward elliptic motion, independent model integration, fixed pixel geometry, bright-background casing and legend order, zero/extreme values, offscreen bodies, changed launch parameters, the planet cap, animation, quiet redraws, context/density recovery, retained worlds, shared parameters and unchanged discovery evidence. Public cloud-browser checks supplement these deterministic tests; physical touch, rotation, screen-reader speech, hardware graphics failure and downloaded-file receipt remain unverified.


## See how a fractal rule constrains the next location

The existing Fractal instrument drawer now shows the three first-level images of the outer triangle. Moving any possible starting point toward A, B or C by the selected jump fraction r maps the hull by p′ = (1−r)p + rv. Each smaller triangle therefore has side-length scale 1−r: jumping 38% makes 62%-sized images that overlap; at 50% they meet only at the outer side midpoints; at 65% the 35%-sized images are separated. Changing the jump updates this diagram, while the seed and point count do not. This illustrates the contraction rule described by [Wolfram MathWorld’s Chaos Game](https://mathworld.wolfram.com/ChaosGame.html); the first-level regions and their intersection thresholds are derived from that rule here.

The diagram is an enclosure obtained by transforming every start in the outer hull once, not an observed point cloud, probability shading or the complete attractor. A single current point has only three candidate next positions. Overlapping images do not guarantee every point in them is visited. A/B/C labels match the main canvas, and solid/long-dash/dotted outlines supplement color. The nearby quiet text describes the same geometry. The SVG retains its aspect ratio and stacks above its explanation on narrow screens; it adds no control or live announcement. Its attributes and text are preserved on unchanged redraws. No simulation state, random draw, checkpoint, discovery evidence, storage, dependency or domain configuration changes.

`tests/fractal-regions.test.js` verifies all supported jump ratios against an independent barycentric oracle, exact contraction lengths and midpoint contact, generated-point enclosure, parameter/preset/reset paths, quiet animation and replay, retained worlds, density/context restoration, observation links and unchanged notebook evidence. Public cloud-browser checks supplement the controlled tests; physical touch, device rotation, screen-reader speech and hardware graphics loss remain unverified.


## Read the direction rule behind random-walk drift

Walk's existing instrument drawer now shows four labeled bars for each walker's theoretical per-step direction probabilities, all on the same 0–100% scale. At zero bias every direction is 25%; at 25% bias they are right 37.5%, left 12.5%, up 25% and down 25%. The nearby explanation connects these unconditional weights to the existing rule: each step has a 50% probability of being horizontal, and within that choice the rightward chance is 50% plus the bias in percentage points. This makes “25% bias” distinguishable from “25% of all steps go right.” The widths come directly from the existing sampler's branch intervals; they do not measure a path or promise exact quotas from a finite pseudorandom sequence.

The chart follows the current model bias through parameters, presets, guides, checkpoints and retained worlds. Seed, step count, replay, animation and viewport changes do not alter the rule. Direction names and numeric percentages carry the meaning independently of the decorative bars; the quiet list has no extra controls, focus stops or announcements. Unchanged redraws retain both text and width attributes. It adds no model state, random draw, storage, dependency or change to discovery evidence, and the original batch controls remain repeatable.

`tests/walk-choice-rule.test.js` checks all 26 supported biases, an independent conditional-probability calculation, exact sampler boundary draws obtained with a BigInt modular inverse, fractional percentages, rule/model continuity through replay and limits, quiet redraws, parameter and preset resets, density/context recovery, retained worlds, fixed checkpoints, notebook integrity and accessible markup. Public cloud-browser checks supplement these controlled tests; physical touch, device rotation, screen-reader speech and hardware graphics loss remain unverified.


## Compare a new launch with an escape reference

Orbit's existing next-launch instrument now compares the proposed speed with a same-radius ideal escape speed. At the default radius 140 and gravity 80, the circular reference is 23.9 and the escape reference is 33.8 model units per second. The explanation connects the speed slider to the threshold: escape speed is √2 times circular speed, about 141.4%, so the supported integer settings 141% and 142% lie on opposite sides. The reading is explicitly about the next orange-marker launch, not the already moving white-diamond planet or the bodies created by an “escape” preset. Leaving the screen remains separate from escaping.

For allowed launches the radius is at least 22, outside the model's softened core at 18. The same-radius circular speed already computed by the launcher is multiplied by √2, following the fixed-field energy relation in [OpenStax University Physics §13.3](https://openstax.org/books/university-physics-volume-1/pages/13-3-gravitational-potential-energy-and-total-energy) and its [circular-orbit comparison in §13.4](https://openstax.org/books/university-physics-volume-1/pages/13-4-satellite-orbits-and-energy). The nearby help states the assumptions of unchanged gravity and no drag and identifies numerical approximation; it does not promise that the discretely integrated trajectory is an exact escape classifier. Unavailable central placements show a location prompt rather than an unsoftened formula inside the core.

The quiet reading follows position and parameter edits, resets, guides, presets and retained worlds. Step, Pause and explicit positioning include it in the existing action announcement. Animation and unchanged redraws do not rewrite or announce it. It uses the existing instrument layout and adds no control, plot, model state, trajectory calculation, random draw, storage, dependency or domain configuration change. Existing parameter-only sharing, discovery evidence and batch-repeat behavior remain unchanged.

`tests/orbit-escape-reference.test.js` checks all 131 supported gravity values and 121 launch-speed settings at four valid radii against an independently expressed energy threshold, two-dimensional radius, central exclusion, preset scope, caps, exact model integration, quiet redraws, animation, density/context recovery, retained worlds, sharing and discovery evidence. The eleven new cases fail on the preceding code. Public cloud-browser verification supplements the controlled tests; physical touch, device rotation, screen-reader speech, hardware graphics loss and downloaded-file receipt remain unverified.


## See where a paused Life generation changed

Ordinary paused Life steps now reuse the existing next-generation comparison marks: cyan frames identify newborn cells, orange crosses identify vanished cells, and yellow-green fills alone show the current live board. A nearby quiet caption names the exact adjacent generations and counts. A blinker therefore visibly shows two births and two deaths even though its population remains three. Still patterns and empty boards explicitly report no births or deaths. The special four-cell challenge retains its own comparison caption without duplicating the new one.

The overlay reads the already retained predecessor and current board. The first render of a new generation and later redraws select the same predecessor; there is no new history, state, simulation step or inverse evolution. Running hides the marks, while Pause and Step show the latest recorded transition and include the caption in the existing action announcement. Rewind follows the corresponding previous pair; at the oldest retained board no predecessor is invented. Edits or replacement boards start a new comparison, and existing undo restores it. Birth frames have dark casing to separate cyan from the bright live-cell fill, while the selected cell's orange outline stays on top. Color is supplemented by distinct frame/cross shapes and text counts.

The caption wraps below the canvas, adds no control or live region, and preserves its text node on unchanged redraws. The PNG saver still captures the current canvas, including any visible marks; its existing canvas-only capture does not include the external caption. Sharing remains parameter-only for Life, and discovery checks, other worlds, the intentional batch-repeat controls, domain configuration, storage and dependencies are unchanged.

`tests/life-transition.test.js` checks an independent simultaneous-rule oracle, blinker/glider/pulsar steps, wrapped edges, still life/extinction, narrow/fractional geometry, contrast casing and selection layering, first-render/redraw equivalence, rewind and history limits, edits and undo, animation, quiet redraws, density/context restoration, retained worlds, sharing and notebook evidence. Public cloud-browser checks supplement these deterministic tests; physical touch, device rotation, screen-reader speech, hardware graphics loss and downloaded-file receipt remain unverified.


## Recall an accidental Orbit launch

The near-canvas “撤回最近发射” button removes only the most recently and successfully added planet, then pauses. The other planets retain their exact current positions, velocities and trails; elapsed time, launch position and parameters do not rewind. This is one-level removal rather than a history stack: after using it, older launches cannot be removed until another successful launch establishes a new opportunity. Initial preset planets are never removable through this action.

One reference to the launched body survives animation, stepping, parameter edits, view changes and experiment-tab round trips. Invalid or capped launch attempts preserve it. Reset, a preset, a guide, a new exploration or changed URL settings replace the scene and clear it. At the 24-planet cap, the existing guidance now offers recall; removing one immediately frees a launch slot. The unavailable button retains keyboard focus and does nothing, without pausing or replacing feedback. Quiet availability text and an associated explanation state the scope and expiry. The action row wraps on narrow screens.

No integration rule, shared-link content, discovered note, baseline measurement, storage, dependency or domain configuration changes. `tests/orbit-recall.test.js` covers exact remaining body render/trail preservation, all launch inputs, running and paused use, parameters, one-level bounds, cap and invalid attempts, resets and retained tabs, history, resize/density/context restoration, keyboard defaults and discovery integrity. Deterministic events do not establish physical touch, screen-reader speech or hardware graphics behavior.


## Pause a focused canvas without changing the experiment

All five canvases now accept unmodified Esc as a one-way pause. Keyboard visitors can stop at the current moment without taking an extra replay step, launching a planet, moving the probe or changing a Life cell. Focus stays on the canvas; the existing Continue button remains the explicit way to resume. A short visible explanation beside the primary controls is associated with the canvas, and `aria-keyshortcuts="Escape"` exposes the shortcut. The text wraps at narrow widths without adding a control or focus stop.

The shortcut is scoped to the canvas. Modified and composing key events remain native, and held repeats do nothing. Pressing Esc on an already paused canvas leaves the current action feedback and drawing untouched. If a Life pointer stroke is still active, Esc instead ends that gesture using the existing interruption path: already drawn cells and their one-level undo are retained, while a pending tap and the interrupted pointer's trailing release/click cannot add a new edit. This does not undo the stroke. A real transition to paused uses the existing measurement announcement once.

No simulation rule, model time, random sequence, parameter, selection, saved checkpoint, discovery note, dependency, storage or domain setting changes. Tab retention, context recovery, density changes and reduced-motion behavior keep the pause decision. Arrow positioning and the intentional Fractal/Walk batch-repeat controls retain their behavior.

`tests/canvas-pause-key.test.js` covers all five running models against the original Pause control and subsequent exact rendering, paused and held-key no-ops, modifier/IME exclusions, active and pending Life gestures, trailing events, undo/clear recovery, Orbit recall, retained worlds, shared observations, discovery evidence, limits, interrupted visibility/context, density and help markup. Thirteen of its eighteen checks fail before the change; five compatibility checks pass before and after. Public cloud-browser checks supplement deterministic coverage. Physical touch, screen-reader speech, device rotation, hardware graphics loss and downloaded-file receipt remain unverified.


## Keep Life’s unchanged local readings stable

Life’s selected-cell inspector now changes its six text readings and nine neighborhood attributes only when their displayed values change. A stable four-cell block running for 120 generations at 20 generations per second avoids 720 identical text replacements and 1,080 identical mini-grid attribute writes in the controlled regression test. Cursor movement still updates its coordinates; actual births, deaths and neighbor changes immediately refresh the rule prediction, toggle label and mini-grid. This is a measured reduction in redundant DOM writes, not a claimed frame-rate or device-battery improvement.

The renderer compares the actual DOM, without a separate cached model. Unchanged redraws preserve text nodes through resizing, focus changes, display-density updates, context recovery and retained-world returns. The same rule, simultaneous model evolution, history, edit/clear recovery, comparison, sharing and completed discoveries remain intact. No new UI, live announcement, storage, dependency or domain change is introduced.

`tests/life-inspector-writes.test.js` checks write counts and exact readings against independently counted rendered neighborhoods, all alive/dead neighbor counts, wrapped cursor moves, evolving blinkers, rewind and recovery, retained worlds, DOM repair, interruptions, sharing and discovery integrity. All ten new checks fail on the preceding renderer and pass with change-only updates. These controlled write counts do not establish real-device performance or assistive-technology behavior; physical touch, screen-reader speech, device rotation, hardware graphics loss and downloaded-file receipt remain unverified.


## Return Life’s cursor to the center

The near-canvas “框选回中央” button and unmodified canvas Home key select the same default central cell (column 25, row 17) and pause. Visitors can return from an edge in one action instead of repeated arrow presses, while the board, generation, history, comparison, edit/clear recovery and discoveries remain intact. The explicit help states the exact cell in the even-sized 48 × 32 board. Focus remains on the initiating control, and the button sits outside the compact arrow grid so it can wrap at narrow widths.

An active pointer gesture ends through the existing interruption path: completed drawing and its undo remain available, and the interrupted release/click cannot add a later edit. A pending tap does not become a cell edit. Held Home and held button Enter do not repeat the command; modified/composing Home remains native. The other worlds keep their existing Home and batch-step behavior. No physics, random sequence, share content, storage, dependency or domain setting changes.

`tests/life-center.test.js` covers both inputs, running and paused boards, edges, resize, native-key exclusions, comparison and edit/clear recovery, interrupted gestures, notes and retained sessions, visibility/density/context restoration and markup. Deterministic interruption checks do not establish physical touch or hardware graphics behavior.


## Keep a good position through an unusable canvas click

Orbit and Wave now reject a pointer-to-model conversion when the event coordinates, canvas bounds, current drawing dimensions or view scale are unusable. A delayed click during a zero-sized layout therefore cannot replace a valid launch point or probe with NaN/Infinity. Validation happens before any position, pause state, drawing, feedback or URL is changed. The next valid click works normally, without requiring Home or Reset. The existing pointer-specific delayed-click suppression still runs first.

Ordinary finite clicks keep their original mapping, including shifted, fractional and CSS-scaled bounds and finite positions outside the rectangle. Orbit pointer launches still keep the current running state; Wave measurements still pause. Model integration, launch recall, saved observations, discoveries, Life drawing/recovery and intentional Fractal/Walk batch steps are unchanged. No new control, storage, dependency or domain setting is introduced.

`tests/canvas-position-geometry.test.js` checks malformed events, collapsed bounds before and after resizing, nonpositive scale and numeric overflow, exact unchanged state, next-valid-click recovery, normal coordinate mapping, recall, checkpoints, discoveries, retained worlds and density/context interruption. Twelve of its sixteen checks fail on the preceding code; four compatibility checks pass before and after. These are controlled event tests. Public cloud-browser checks cover normal interaction and narrow reflow, not a physically reproduced delayed touch during layout collapse, screen-reader speech, rotation, hardware graphics loss or downloaded-file receipt.


## Undo a return to a saved observation

Wave, Fractal and Walk now offer “撤销这次返回” inside the existing saved-observation panel. Returning to a fixed link can otherwise replace a later, unsaved observation. The new control restores the most recent pre-return moment and pauses, without changing the link, parameters, exploration checks or completed discoveries. It is one-level recovery, with no redo or general history. Returning again while already at the checkpoint preserves the useful recovery instead of overwriting it with the checkpoint itself.

The recovery contains only a small observation descriptor, model time, partial animation-batch accumulator and Wave view bounds. Seeded worlds regenerate their exact sequence on demand; no second point cloud, walker ensemble or trajectory history is retained. Undo also preserves the next seeded update and a partly completed animation batch. Wave restores the previous probe, exact phase and fitted view, including in-page observations outside the bounded share-link format.

Stepping, continuing, probe movement, resize, display-density and context restoration, and visits to other worlds retain each world's recovery. A real parameter change, Reset, replacement preset, guide, exploration or URL state, or generating another shared link clears it. A no-op parameter change and a refused out-of-range share do not. Refresh clears all page-only recovery. The button remains focusable when unavailable and performs a quiet no-op; using it retains focus and consumes its recovery. Held Enter cannot invoke it repeatedly. Its nearby status and explanation wrap within the existing panel and add no live region.

`tests/observation-return-recovery.test.js` covers exact restored renderings and next updates, fractional animation time, one-level/repeated-return behavior, per-world retention, expiry, range boundaries, parameter-only worlds, fixed links, obsolete clipboard callbacks, mission/notebook integrity, recovery after resize/density/context interruption, quiet redraws, native keys and markup. Public cloud-browser interaction and zoomed reflow checks supplement these deterministic events. Physical touch, screen-reader speech, IME candidate windows, device rotation, hardware graphics loss, real layout-collapse timing and downloaded-file receipt remain unverified.


## Copy a fixed observation while continuing to explore

The saved-observation panel now offers “复制这条观测链接” for Wave, Fractal and Walk. It copies the checkpoint already described in that panel, even after the current experiment moves on. Opening a checkpoint no longer requires saving the newer moment just to obtain a copyable link. The existing “暂停并分享此刻” control remains the way to capture and share the current observation.

Copying the fixed link does not pause, redraw, change parameters, rewrite the URL, replace a checkpoint or consume return recovery. Focus stays on the initiating control; the existing readonly link field becomes available above it for manual copying if clipboard access fails or is unavailable. The shared request token suppresses obsolete clipboard feedback across retries, new sharing, returns, undo, parameter changes and world changes. The new button suppresses held Enter activation and wraps in the existing panel. Copying remains possible when the current Wave probe or time has moved beyond the bounded link format because it uses the previously validated fixed checkpoint.

No new observation format, model state, simulation rule, storage, dependency, domain setting or live region is introduced. Intentional Fractal/Walk batch repeats are unchanged. `tests/saved-observation-copy.test.js` covers fixed-link provenance, all three running and paused worlds, exact rendering and recovery preservation, range boundaries, clipboard failure and missing API, focus, invalid/parameter-only checkpoints, retained worlds, completed discoveries, context recovery, asynchronous races, keyboard defaults and wrapping markup. Public cloud-browser interaction and narrow zoomed reflow supplement deterministic checks; physical touch, screen-reader speech, IME candidate windows, device rotation, hardware graphics loss, real layout-collapse timing and downloaded-file receipt remain unverified.


## Select the complete sharing link for manual copying

The existing readonly share field now selects its complete URL when a visitor focuses or clicks it. A normal click previously placed a caret inside the long URL without selecting text. The field’s quiet, associated instructions explain Ctrl+C, ⌘C and the system Copy menu. They stay visible whenever that field is visible, including after an automatic-copy success, failure or pending result, and disappear with it through parameter edits and retained-world changes. No additional copy button or live region is introduced.

Selection only acts on the displayed field. It does not read the clipboard, retry automatic copying, change copy feedback, capture a new observation, pause the model, consume return recovery or move focus elsewhere. Native keyboard copy and text-navigation shortcuts are unchanged. The automatic-copy result still reflects the API outcome; the site does not read back or verify a visitor’s eventual paste. One cloud-session check found that a reported automatic-copy success could coexist with stale native paste contents for both existing sharing and fixed-observation copying; that does not establish a defect in either control. Manual copying remains an independent recovery route.

`tests/share-manual-selection.test.js` covers all five running experiments, complete-link selection, repeated focus/click, fixed checkpoint and return recovery, missing/rejected/successful/pending copy APIs, stale callback ownership, native shortcuts and quiet responsive markup. These controlled checks do not establish physical touch, mobile context menus, screen-reader speech, IME candidate windows, device rotation, hardware graphics loss, real layout-collapse timing or downloaded-file receipt.


## Revisit the preceding Wave phase

The near-canvas “退回 ¼ 周期 −” control moves the existing Wave clock back by one quarter period and pauses. Visitors can compare a bright, dark or opposite-sign phase in both directions without restoring a saved observation. It uses the same fixed angular speed and direct displacement evaluation as forward stepping; no history buffer, reverse integration or additional phase state is introduced.

Rewind stops at t = 0, rounding only a rewind result within 10⁻¹² model seconds of the origin to zero to remove accumulated floating-point residue. If less than a quarter period remains, it returns to zero and explains that shorter move. At the origin the button stays focusable and is a quiet no-op, including before the first running frame. Held Enter does not repeat the command; fresh keyboard and pointer activation remain available. Quiet boundary guidance sits next to the wrapping, 44-pixel-minimum control and is associated with it. Unchanged redraws retain that text node.

Parameters and the probe remain at their current values; this is phase review, not an undo of previous parameter or position edits. The fixed shared link, saved-return recovery, discoveries and other worlds are unchanged. Continue resumes from the revisited time without fast-forwarding, while resets, guides and preset replacements restore the same time origin as before. Existing floating-point precision applies, especially at large shared times. No storage, dependency, domain configuration or simulation law changes.

`tests/wave-rewind.test.js` checks an independent two-source expression, center/cancellation/mixed/far probes, the maximum shareable time, full and partial quarter steps, the zero boundary, running interruption and resumption, focus and keyboard defaults, quiet rendering, fixed links and pending copying, return recovery, reset/parameter/history paths, retained worlds, discovery integrity, and simulated reflow/density/context restoration. Public cloud-browser interaction and zoomed reflow supplement controlled checks; physical touch, screen-reader speech, IME candidate windows, device rotation, hardware graphics loss and downloaded-file receipt remain unverified.


## Keep Wave precision movement inside a usable view

Wave's directional buttons and canvas arrow keys now reject movement when the observed canvas size, fitted scale or derived bounds cannot support positioning. A temporary collapsed view previously inverted the clamp bounds: a right command at (800, −300) in a simulated 20 × 20 canvas moved the probe to (375, 375), and that unintended measurement survived layout recovery. The same command now leaves the probe, phase, running choice, saved link, return recovery and discovery notebook unchanged, with no redraw or announcement.

The explicit center action remains available because it resets a model-space position without requiring viewport bounds. Normal two-unit movement, held directional keys, edge clamping and fitted distant probes remain unchanged after a usable view returns. No new state, UI, simulation rule, dependency, storage or domain change is introduced.

`tests/wave-position-safety.test.js` reproduces the former failure for buttons and keys, running and paused sessions, zero/negative scale boundaries, exact field restoration, fixed checkpoints, return undo, completed discoveries, context/density/tab interruptions, center reset and fractional reflow. Layout collapse is simulated; actual device layout-collapse timing, physical touch, IME input, screen-reader speech, hardware context loss and download receipt are not established by these tests.


## Keep Orbit positioning inside a usable view

Orbit's directional buttons and canvas arrow keys now leave the selected launch position and running choice untouched while the observed canvas dimensions, fitted scale or derived placement bounds are unusable. A simulated 20 × 20 collapse previously let a right command move (140, −5) to (145, −5), changing the next launch speed and pausing the scene despite having no usable placement bounds. The altered selection survived layout recovery. Rejected movement now leaves feedback, focus, pending animation, existing planets and recall unchanged.

Home and explicit launch remain available as model-space actions. Once usable geometry returns, five-unit movement, held directional keys and the existing edge clamp work normally. No simulation rule, shared-link content, notebook, storage, dependency or domain setting changes.

`tests/orbit-position-safety.test.js` covers running and paused buttons/keys, collapsed and nonfinite geometry, exact preview and body/trail restoration, subsequent integration, recall, fixed parameters/share state, discovery evidence, retained worlds, context/density interruptions, Home/launch compatibility, fractional reflow and native key exclusions. Collapse and invalid dimensions are simulated; physical touch, IME candidate windows, screen-reader speech, device rotation, hardware graphics loss and downloaded-file receipt remain unverified.

## Find a living Life cell without searching the empty board

The Life cursor now offers “上一个活格” and “下一个活格” beside its existing directional controls. They browse the current board in row order (left to right, then top to bottom), wrapping at either end. A successful selection pauses, keeps keyboard focus on the button, and announces the selected cell through the existing action region. This makes a sparse or moved pattern reachable without pointing at tiny cells or stepping through as many as 1,536 empty squares. The search never changes cells, advances a generation, or records a discovery.

A lone living cell remains reachable; a complete circuit back to that cell explains that it is the only one. On an empty board both buttons remain focusable with `aria-disabled`, and quiet text explains how to begin. Unavailable clicks do nothing, including leaving a running empty board running. Each search examines at most one board. Native fresh Enter/Space work; held Enter cannot race around a pattern. No canvas shortcut or existing held batch action changes.

Selection retains the current generation, fractional evolution timing, history, comparison, edit undo, clear recovery, parameter link and notebook. An active drawing is safely interrupted without losing its existing trailing-click protection. Availability follows edits, steps, rewind, presets and session returns. `tests/life-living-navigation.test.js` covers independent search oracles, a glider whose old cursor is empty after eight generations, wraparound and bounds, exact board preservation, empty and sole-cell behavior, interruptions, keyboard focus, recovery, narrow/fractional redraws and existing discovery evidence. These simulated checks do not establish physical touch or screen-reader speech; public browser keyboard/layout verification is reported separately.

## Jump directly to a chosen Fractal observation

The near-canvas “目标点数” field and “定位并暂停” control accept an integer from 300 through 12000. Visitors can inspect an arbitrary point in the seeded sequence without many single-point presses or coarse batches. Enter in the field works too. A valid destination replays the current seed and jump ratio to that exact count, pauses and clears the partial animation batch, while keeping the next seeded draw identical. The current count can also be submitted to pause and inspect it.

Typing is separate from the experiment: animation, redraws, resizing and visits to other worlds do not replace an unfinished destination. Invalid or out-of-range text produces an associated correction message and focuses the field, without pausing, drawing, clamping the target or changing the model. Editing clears that error. Held Enter cannot repeatedly rebuild the sequence; modified or composing Enter and ordinary editing keys remain native. The destination remains a visitor-entered target rather than a live progress reading.

Positioning preserves fixed shared observations, one-level return recovery and completed discoveries. Only the existing Share action updates a link, and only an explicit successful exploration check records a discovery. The seeded model, physics, parameter and preset semantics, retained worlds, intentional Fractal/Walk batch repeats, storage, dependencies and domain settings are unchanged. Controls wrap and retain 44-pixel minimum target heights beside the existing single-point controls, outside the instrument drawer.

`tests/fractal-seek.test.js` checks independently computed seeded point geometry, exact reverse/forward replay and next draws, bounds and invalid input, focus and keyboard exclusions, running-state interruption, partial batch clearing, fixed links and asynchronous sharing, recovery, retained worlds, parameter/URL changes, discovery evidence and simulated reflow/density/context interruptions. Public cloud-browser behavior and narrow reflow are verified separately. Physical touch, IME candidate windows, screen-reader speech, device rotation, hardware graphics loss and downloaded-file receipt remain unverified.


## Preserve Orbit’s exact home in a narrow view

Orbit’s “归位并预演” button and canvas Home key now fit a fresh view around the promised (140, 0) model position instead of clamping that position to the old default view. In a simulated 150-pixel-wide usable canvas, Home previously moved x = 140 to x = 123 and changed the next launch speed. The same fitted home is established by Reset and replacement starting states, so the first vertical movement no longer shifts the horizontal position as a side effect.

The old expanded view is still released, normal-size scale is unchanged, and directional movement keeps its five-unit steps and stable bounds. Home pauses and keeps focus without moving existing planets, advancing the clock, consuming launch recall, changing shared parameters or recording a discovery. Simulation integration, all other worlds, intentional batch repeats, storage, dependencies and domain settings are unchanged.

`tests/orbit-home-fit.test.js` checks exact geometry across narrow and ordinary sizes, both inputs while running or paused, resets/presets/guides/history, next movement and launch, existing-body integration, retained worlds, sharing and notes, and simulated display/context interruptions. Public cloud-browser checks cover ordinary interaction and zoomed reflow separately; the extreme narrow geometry is a controlled regression, not a claim of physical-device testing. Physical touch, screen-reader speech, IME candidate windows, rotation, hardware graphics loss and downloaded-file receipt remain unverified.
