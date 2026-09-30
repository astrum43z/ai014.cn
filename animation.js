// One frame chain, with no background work while the experiment cannot run.
export function createAnimationLoop({request, cancel, update, canRun}) {
  let pending = null;
  let previous = null;
  function frame(now) {
    pending = null;
    if (!canRun()) { previous = null; return; }
    const dt = previous === null ? 0 : Math.min(Math.max((now - previous) / 1000, 0), .05);
    previous = now;
    if (dt > 0) update(dt);
    if (canRun()) pending = request(frame);
    else previous = null;
  }
  function sync() {
    if (!canRun()) {
      if (pending !== null) cancel(pending);
      pending = null;
      previous = null;
    } else if (pending === null) {
      previous = null;
      pending = request(frame);
    }
  }
  return {sync};
}
