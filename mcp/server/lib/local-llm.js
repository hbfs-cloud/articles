/**
 * Local LLM orchestration module
 * Invokes locally-installed AI CLIs (Claude Code, Gemini CLI, etc.)
 *
 * Feature detection: only exposes tools for CLIs that exist on the machine.
 * The MCP client can be any LLM — this enables cross-model collaboration:
 *   - Gemini calling Claude for a second opinion
 *   - Claude calling Gemini for grounded web search
 *   - Cursor/Windsurf calling either for specialized analysis
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ── CLI definitions ──

const CLI_DEFS = {
  claude: {
    names: ['claude'],
    flag: '--version',
    buildArgs: (prompt, opts) => {
      const args = ['-p', prompt, '--output-format', 'text'];
      if (opts.model) args.push('--model', opts.model);
      if (opts.allowedTools?.length) args.push('--allowedTools', ...opts.allowedTools);
      if (opts.appendSystemPrompt) args.push('--append-system-prompt', opts.appendSystemPrompt);
      if (opts.maxTurns) args.push('--max-turns', String(opts.maxTurns));
      return args;
    },
    defaultTimeout: 180_000,
    description: 'Claude Code CLI (claude -p). Best for: code analysis, refactoring, tool-use tasks, MCP-aware queries.'
  },
  gemini: {
    names: ['gemini'],
    flag: '--version',
    buildArgs: (prompt, opts) => {
      const args = ['-p', prompt];
      if (opts.model) args.push('-m', opts.model);
      if (opts.sandbox === false) args.push('--sandbox', 'false');
      return args;
    },
    defaultTimeout: 120_000,
    description: 'Gemini CLI (gemini -p). Best for: web-grounded search, fact-checking, cross-validation, Google ecosystem data.'
  }
};

// ── State ──

const _available = {};

// ── Feature detection at startup ──

export async function detect() {
  for (const [key, def] of Object.entries(CLI_DEFS)) {
    for (const name of def.names) {
      try {
        const { stdout } = await execFileAsync(name, [def.flag], { timeout: 5000 });
        _available[key] = { binary: name, version: stdout.trim(), ...def };
        break;
      } catch {
        // Binary not found or unresponsive — skip
      }
    }
  }
  return Object.keys(_available);
}

// ── List available CLIs ──

export function available() {
  return Object.entries(_available).map(([key, def]) => ({
    key,
    binary: def.binary,
    version: def.version,
    description: def.description
  }));
}

// ── Build clean env for child process ──

function cleanEnvFor(opts = {}) {
  const env = { ...process.env, ...(opts.env || {}) };
  // Remove all Claude/Anthropic session vars to prevent nested-session detection
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE') || key.startsWith('ANTHROPIC_')) delete env[key];
  }
  // Re-add API key if present (needed for Claude API access)
  if (process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  return env;
}

// ── Invoke a CLI using spawn (required: some CLIs hang with execFile if stdin isn't closed) ──

function spawnAsync(binary, args, { timeout, env, cwd }) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    let killed = false;

    const child = spawn(binary, args, {
      env,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately — CLIs in -p mode don't need it
    child.stdin.end();

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      // Force kill after 5s if SIGTERM didn't work
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(Object.assign(new Error('Timeout'), { killed: true, stdout, stderr }));
      } else if (code !== 0) {
        reject(Object.assign(new Error(`Exit code ${code}`), { code, stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Invoke a local CLI ──

export async function invoke(cli, prompt, opts = {}) {
  const def = _available[cli];
  if (!def) {
    const avail = Object.keys(_available);
    throw new Error(`CLI "${cli}" not available. Available: ${avail.length ? avail.join(', ') : 'none (run detect() first)'}`);
  }

  const args = def.buildArgs(prompt, opts);
  const timeout = opts.timeout || def.defaultTimeout;
  const env = cleanEnvFor(opts);

  try {
    const { stdout, stderr } = await spawnAsync(def.binary, args, {
      timeout,
      env,
      cwd: opts.cwd || process.cwd()
    });

    return {
      cli,
      binary: def.binary,
      success: true,
      output: stdout.trim(),
      stderr: stderr?.trim() || null,
      prompt,
      model: opts.model || 'default'
    };
  } catch (err) {
    if (err.killed) {
      return { cli, success: false, error: `Timeout after ${timeout}ms`, prompt };
    }
    if (err.stdout) {
      return {
        cli,
        success: false,
        output: err.stdout.trim(),
        error: err.stderr?.trim() || err.message,
        prompt
      };
    }
    throw err;
  }
}

// ── Ask multiple CLIs the same question (parallel) ──

export async function consensus(prompt, opts = {}) {
  const clis = opts.clis || Object.keys(_available);
  const results = await Promise.allSettled(
    clis.map(cli => invoke(cli, prompt, opts))
  );

  return clis.map((cli, i) => {
    const r = results[i];
    return r.status === 'fulfilled'
      ? r.value
      : { cli, success: false, error: r.reason?.message || 'Unknown error' };
  });
}
