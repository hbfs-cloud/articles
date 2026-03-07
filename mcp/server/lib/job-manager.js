/**
 * Job Manager — central registry for all background tasks
 *
 * Every background job (enricher, bars-worker, rolling-scanner, monitor…)
 * registers here. The user can start/stop/pause/resume/schedule any job
 * via MCP tools and see the full state in one call.
 *
 * Schedule formats (passed to setSchedule / register):
 *   { every: '5min' }          every 5 minutes
 *   { every: '30min' }
 *   { every: '1h' }
 *   { every: '6h' }
 *   { every: '1d' }
 *   { daily: '09:00' }         every day at 09:00 UTC
 *   { daily: '09:00', weekday: 1 } Monday only (0=Sun … 6=Sat)
 *
 * Job lifecycle:
 *   idle → start() → running → stop() → idle
 *                  → pause() → paused → resume() → running
 *   Any state → error (on uncaught run error)
 */

// ─── Store ────────────────────────────────────────────────────────────────────

const _jobs = new Map();  // id → job

// ─── Public: register ─────────────────────────────────────────────────────────

/**
 * Register a job.
 *
 * @param {string} id        Unique identifier (e.g. 'enricher', 'bars_worker')
 * @param {object} def
 *   name        {string}
 *   description {string}  optional
 *   type        {string}  'periodic' | 'scanner' | 'oneshot'
 *   fn          {async function(job)} — one cycle of work
 *   stopFn      {function}  optional — called on stop()
 *   pauseFn     {function}  optional — called on pause()
 *   resumeFn    {function}  optional — called on resume()
 *   schedule    {object}    optional initial schedule
 *   autoStart   {boolean}   if true + schedule given, starts automatically
 */
export function register(id, def) {
  if (_jobs.has(id)) return _jobs.get(id);

  const job = {
    id,
    name:        def.name        || id,
    description: def.description || '',
    type:        def.type        || 'periodic',
    status:      'idle',
    schedule:    def.schedule    || null,
    _fn:         def.fn,
    _stopFn:     def.stopFn   || null,
    _pauseFn:    def.pauseFn  || null,
    _resumeFn:   def.resumeFn || null,
    // Runtime state
    _timer:      null,
    _running:    false,
    createdAt:   new Date().toISOString(),
    startedAt:   null,
    lastRun:     null,
    nextRun:     null,
    runCount:    0,
    errorCount:  0,
    lastError:   null,
    lastResult:  null,
    // Scanner extras (populated by rolling-scanner)
    progress:    null,
  };

  _jobs.set(id, job);

  if (def.schedule && def.autoStart !== false) {
    _applySchedule(job);
  }

  return job;
}

// ─── Public: control ──────────────────────────────────────────────────────────

export function start(id) {
  const job = _get(id);
  if (job.status === 'running') return _pub(job);
  _clearTimer(job);
  job.status    = 'running';
  job.startedAt = new Date().toISOString();
  _runCycle(job);
  return _pub(job);
}

export function stop(id) {
  const job = _get(id);
  _clearTimer(job);
  if (job._stopFn) try { job._stopFn(); } catch {}
  job.status  = 'idle';
  job.nextRun = null;
  return _pub(job);
}

export function pause(id) {
  const job = _get(id);
  _clearTimer(job);
  if (job._pauseFn) try { job._pauseFn(); } catch {}
  if (job.status !== 'idle') job.status = 'paused';
  job.nextRun = null;
  return _pub(job);
}

export function resume(id) {
  const job = _get(id);
  if (job.status !== 'paused') return _pub(job);
  if (job._resumeFn) try { job._resumeFn(); } catch {}
  job.status = 'scheduled';
  if (job.schedule) _applySchedule(job);
  else _runCycle(job);
  return _pub(job);
}

export function runNow(id) {
  const job = _get(id);
  _clearTimer(job);
  job.status = 'running';
  _runCycle(job);
  return _pub(job);
}

export function remove(id) {
  const job = _jobs.get(id);
  if (!job) return false;
  _clearTimer(job);
  if (job._stopFn) try { job._stopFn(); } catch {}
  _jobs.delete(id);
  return true;
}

// ─── Public: scheduling ───────────────────────────────────────────────────────

/**
 * Set or update the schedule for a job.
 * @param {string} id
 * @param {object|null} schedule   null = remove schedule (idle after current run)
 */
export function setSchedule(id, schedule) {
  const job = _get(id);
  _clearTimer(job);
  job.schedule = schedule || null;
  if (job.schedule && job.status !== 'paused') {
    _applySchedule(job);
  } else if (!job.schedule) {
    job.status  = 'idle';
    job.nextRun = null;
  }
  return _pub(job);
}

// ─── Public: query ────────────────────────────────────────────────────────────

export function list() {
  return [..._jobs.values()].map(_pub);
}

export function get(id) {
  return _jobs.has(id) ? _pub(_jobs.get(id)) : null;
}

export function getInternal(id) {
  return _jobs.get(id) ?? null;
}

// ─── Internal: run cycle ──────────────────────────────────────────────────────

async function _runCycle(job) {
  if (job._running) return;
  job._running = true;
  job.status   = 'running';
  job.lastRun  = new Date().toISOString();
  job.runCount++;

  try {
    const result = await job._fn(job);
    job.lastResult = result ?? null;
    job.lastError  = null;
  } catch (e) {
    job.errorCount++;
    job.lastError = { message: e.message, at: new Date().toISOString() };
    job.status    = 'error';
    console.error(`[JobManager] ${job.id} error: ${e.message}`);
  }

  job._running = false;

  // Re-schedule if still active
  if (job.status !== 'idle' && job.status !== 'paused' && job.schedule) {
    _applySchedule(job);
  } else if (job.status === 'running') {
    job.status = 'idle';
  }
}

// ─── Internal: scheduling ─────────────────────────────────────────────────────

function _applySchedule(job) {
  _clearTimer(job);
  const ms = _scheduleToMs(job.schedule);
  if (!ms || ms <= 0) return;

  job.nextRun = new Date(Date.now() + ms).toISOString();
  job.status  = job.status === 'running' ? 'running' : 'scheduled';

  job._timer = setTimeout(async () => {
    job._timer = null;
    await _runCycle(job);
  }, ms);
}

/** Parse schedule object → milliseconds until next run */
function _scheduleToMs(sched) {
  if (!sched) return null;

  // { every: '5min' | '1h' | '30s' | '1d' }
  if (sched.every) {
    const m = String(sched.every).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|min|h|hr|hour|d|day)s?$/i);
    if (!m) return null;
    const n    = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const mul  = { s:1000, sec:1000, min:60_000, h:3_600_000, hr:3_600_000, hour:3_600_000, d:86_400_000, day:86_400_000 };
    return Math.round(n * (mul[unit] ?? 60_000));
  }

  // { daily: '09:00', weekday: 1 }  (0=Sun…6=Sat, omit = every day)
  if (sched.daily) {
    const [h, min] = sched.daily.split(':').map(Number);
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(h, min, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    // weekday filter — advance until correct day
    if (sched.weekday != null) {
      while (next.getUTCDay() !== sched.weekday) next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  // { intervalMs: N }
  if (sched.intervalMs) return sched.intervalMs;

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _clearTimer(job) {
  if (job._timer) { clearTimeout(job._timer); job._timer = null; }
}

function _get(id) {
  const job = _jobs.get(id);
  if (!job) throw new Error(`Job "${id}" not found`);
  return job;
}

/** Public-safe job snapshot (no internal refs) */
function _pub(job) {
  const { _fn, _stopFn, _pauseFn, _resumeFn, _timer, _running, ...pub } = job;
  return pub;
}

// ─── Format helpers (for display) ────────────────────────────────────────────

export function formatSchedule(sched) {
  if (!sched) return 'none';
  if (sched.every) return `every ${sched.every}`;
  if (sched.daily) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return sched.weekday != null ? `every ${days[sched.weekday]} at ${sched.daily} UTC` : `daily at ${sched.daily} UTC`;
  }
  if (sched.intervalMs) return `every ${Math.round(sched.intervalMs / 60000)}min`;
  return JSON.stringify(sched);
}
