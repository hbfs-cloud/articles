'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'workflow-contracts.json');
const ISO_DATE_RE = /\b20\d{2}-\d{2}-\d{2}\b/g;
const UNRESOLVED_RE = /\$[A-Za-z_][A-Za-z0-9_]*|<[^>]+>|YYYYMMDD/;

function readConfig(file = CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash('sha256').update(body).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function allCalls(plan) {
  return (plan.waves || []).flatMap((wave, waveIndex) =>
    (wave.calls || []).map(call => ({ wave, waveIndex, call })));
}

function collectVariables(value, out = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) collectVariables(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectVariables(item, out);
  }
  return out;
}

function dateLiterals(value) {
  const found = [];
  const visit = node => {
    if (typeof node === 'string') found.push(...(node.match(ISO_DATE_RE) || []));
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') Object.values(node).forEach(visit);
  };
  visit(value);
  return found;
}

function normalizeSpec(spec = {}) {
  return {
    required_variables: spec.required_variables || [],
    variable_constraints: spec.variable_constraints || {},
    static_symbol_calls: spec.static_symbol_calls || [],
    allowed_date_literals: spec.allowed_date_literals || [],
  };
}

function validateRuntimeVariables(rawSpec = {}, vars = {}) {
  const spec = normalizeSpec(rawSpec);
  const errors = [];
  for (const name of spec.required_variables) {
    if (!(name in vars) || vars[name] == null || String(vars[name]).trim() === '') errors.push(`required runtime variable ${name} is missing`);
  }
  for (const name of ['date', 'scandate']) {
    if (name in vars && !/^20\d{6}$/.test(String(vars[name]))) errors.push(`${name} must use YYYYMMDD`);
  }
  for (const name of ['refdate', 'equity_reference_close', 'crypto_completed_refdate', 'crypto_refdate', 'startdate', 'asof']) {
    if (name in vars && !/^20\d{2}-\d{2}-\d{2}$/.test(String(vars[name]))) errors.push(`${name} must use YYYY-MM-DD`);
  }
  if (vars.request_id != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(vars.request_id))) {
    errors.push('request_id must be a UUID v4');
  }
  const equityReferenceClose = vars.equity_reference_close || vars.refdate;
  if (vars.startdate && equityReferenceClose && vars.startdate > equityReferenceClose) errors.push('startdate must not be after the equity reference close');
  for (const [name, constraint] of Object.entries(spec.variable_constraints)) {
    if (!(name in vars)) continue;
    if (constraint.type !== 'csv') { errors.push(`${name}: unsupported variable constraint type ${constraint.type}`); continue; }
    const rawItems = String(vars[name]).split(',').map(item => item.trim()).filter(Boolean);
    const unique = new Set(rawItems);
    if (rawItems.length !== unique.size) errors.push(`${name}: duplicate CSV items are forbidden`);
    if (rawItems.length < (constraint.min_items || 0)) errors.push(`${name}: needs at least ${constraint.min_items} item(s)`);
    if (constraint.max_items && rawItems.length > constraint.max_items) errors.push(`${name}: exceeds ${constraint.max_items} item(s)`);
    if (constraint.item_pattern) {
      const pattern = new RegExp(constraint.item_pattern);
      for (const item of rawItems) if (!pattern.test(item)) errors.push(`${name}: invalid item ${item}`);
    }
  }
  return [...new Set(errors)];
}

function validatePlan(plan, rawSpec = {}, policy = readConfig().policy) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return ['plan must be a JSON object'];
  const spec = normalizeSpec(rawSpec);
  const errors = [];
  const calls = allCalls(plan);
  const allowedServers = new Set(policy.allowed_servers || []);
  const allowedTools = Object.fromEntries(Object.entries(policy.allowed_tools_by_server || {})
    .map(([server, tools]) => [server, new Set(tools)]));
  const allowedArgs = policy.allowed_args_by_server_tool || {};
  const forbiddenAliases = new Set(policy.forbidden_tool_aliases || []);
  // Collection time is injected once by collect.js and is intentionally not a
  // user-supplied workflow variable.
  const declaredVars = new Set([...(Object.keys(plan.vars || {})), ...spec.required_variables, 'as_of_timestamp']);
  const equityRef = declaredVars.has('equity_reference_close') ? '$equity_reference_close' : '$refdate';

  if (!Array.isArray(plan.waves) || !plan.waves.length) errors.push('waves[] is required');
  if (plan.reference_date != null) errors.push('reference_date must be null/absent in a reusable plan; pass refdate at runtime');
  if (typeof plan.artifact !== 'string' || !plan.artifact.trim()) errors.push('artifact must be a non-empty path template');
  if (typeof plan.artifact === 'string' && /<[^>]+>|YYYYMMDD/.test(plan.artifact)) {
    errors.push(`artifact uses a non-resolvable placeholder: ${plan.artifact}`);
  }

  const firstWave = plan.waves && plan.waves[0];
  if (!firstWave || firstWave.gate !== true) errors.push('first wave must be gate:true');

  const seen = new Set();
  const hasMarketdata = calls.some(({ call }) => call.server === 'marketdata');
  const hasSystematic = calls.some(({ call }) => call.server === 'systematic');
  const gateCalls = firstWave ? (firstWave.calls || []) : [];
  if (hasMarketdata && !gateCalls.some(c => c.server === 'marketdata' && c.tool === 'GetStatus')) {
    errors.push('marketdata plans must start with GetStatus in the gate wave');
  }
  if (hasMarketdata && !gateCalls.some(c => c.server === 'marketdata' && c.tool === 'GetStatus' && c.assert
    && (c.assert.equity_reference_close === equityRef || c.assert.expected_close === equityRef || c.assert.covers_close === equityRef))) {
    errors.push(`marketdata plans must assert GetStatus equity_reference_close=${equityRef} in the gate wave`);
  }
  if (hasSystematic && !gateCalls.some(c => c.server === 'systematic' && c.tool === 'GetHealth' && c.args && c.args.expected_close === equityRef)) {
    errors.push(`systematic plans must start with GetHealth(expected_close=${equityRef}) in the gate wave`);
  }

  for (const { wave, call } of calls) {
    const label = call.as || '(missing as)';
    if (!call.as || typeof call.as !== 'string') errors.push('every call needs a stable as');
    else if (seen.has(call.as)) errors.push(`duplicate call alias: ${call.as}`);
    else seen.add(call.as);

    if (!allowedServers.has(call.server)) errors.push(`${label}: server ${call.server || '(missing)'} is not allowed for content workflows`);
    if (!call.tool || typeof call.tool !== 'string') errors.push(`${label}: tool is required`);
    else if (allowedTools[call.server] && !allowedTools[call.server].has(call.tool)) {
      errors.push(`${label}: tool ${call.tool} is not in the audited ${call.server} capability set`);
    }
    const argumentAllowlist = allowedArgs[call.server] && allowedArgs[call.server][call.tool];
    if (argumentAllowlist) {
      const allowed = new Set(argumentAllowlist);
      for (const key of Object.keys(call.args || {})) {
        if (!allowed.has(key)) errors.push(`${label}: unknown ${call.tool} argument ${key}`);
      }
    }
    for (const pattern of (policy.forbidden_server_patterns || [])) {
      if (String(call.server || '').toLowerCase().includes(pattern.toLowerCase())) errors.push(`${label}: forbidden server pattern ${pattern}`);
    }
    if (forbiddenAliases.has(call.tool) && !(call.server === 'systematic' && call.tool === 'GetHealth')) {
      errors.push(`${label}: deprecated tool alias ${call.tool}`);
    }
    if (!call.freshness || !Number.isFinite(call.freshness.max_age_h) || call.freshness.max_age_h <= 0) {
      errors.push(`${label}: freshness.max_age_h must be a positive number`);
    }
    if (!call.freshness || typeof call.freshness.required !== 'boolean') {
      errors.push(`${label}: freshness.required must be explicit`);
    }
    if (wave.detached && call.freshness && call.freshness.required !== false) {
      errors.push(`${label}: detached waves may contain optional sources only`);
    }
    if (!wave.detached && call.freshness && call.freshness.required === false) {
      errors.push(`${label}: optional sources must live in a detached wave`);
    }

    const argsText = JSON.stringify(call.args || {});
    if (call.server === 'marketdata' && ['RunScreener', 'RunAutoScreener'].includes(call.tool)) {
      if (String(call.args && call.args.region || '').toUpperCase() !== 'US') errors.push(`${label}: ${call.tool} region must be US`);
      if (!['stock', 'etf'].includes(String(call.args && call.args.asset || '').toLowerCase())) errors.push(`${label}: ${call.tool} asset must be stock or etf`);
      if (rawSpec.allow_current_screener_cut === true) {
        if (call.args && Object.hasOwn(call.args, 'as_of')) errors.push(`${label}: ${call.tool} as_of must be omitted when current-cut mode is enabled`);
      } else if (!call.args || call.args.as_of !== equityRef) {
        errors.push(`${label}: ${call.tool} as_of must equal ${equityRef}`);
      }
      if (call.args.force_async !== true) errors.push(`${label}: ${call.tool} force_async=true is required`);
    }
    if (call.server === 'marketdata' && call.tool === 'RunScreener') {
      if (!String(call.args && call.args.pass_expr || '').trim()) errors.push(`${label}: RunScreener pass_expr is required`);
      if (!String(call.args && call.args.score_expr || '').trim()) errors.push(`${label}: RunScreener score_expr is required`);
      const dsl = `${call.args?.pass_expr || ''} ${call.args?.score_expr || ''}`;
      const forbiddenDsl = [
        [/\b(?:and|or)\b/i, 'use &&/|| instead of word operators'],
        [/\b(?:ema|sma)\d+\b/i, 'use ema(close,N)/sma(close,N)'],
        [/\batrpct\b/i, 'use atr() / close'],
        [/\babs\s*\(/i, 'abs() is unsupported'],
      ];
      for (const [pattern, message] of forbiddenDsl) if (pattern.test(dsl)) errors.push(`${label}: invalid screener DSL (${message})`);
    }
    if (call.server === 'marketdata' && call.tool === 'GetMarketContext') {
      const facets = String(call.args?.facets || '').split(',').map(value => value.trim()).filter(Boolean);
      if (facets.includes('overview')) {
        if (facets.length !== 1) errors.push(`${label}: overview must be requested alone`);
        // Le serveur REFUSE désormais as_of sur GetMarketContext, tous facets confondus :
        // « its data is current-only; historical requests are refused to prevent lookahead ».
        // La règle antérieure EXIGEAIT as_of=$refdate sur overview et rendait donc l'appel
        // impossible : la réponse n'était plus qu'un message de refus de 121 octets, que la
        // vérification de fraîcheur laissait passer. Conséquence à assumer explicitement :
        // overview est une observation COURANTE, jamais un point-in-time. Toute valeur qui en
        // sort — le régime compris — se publie comme telle et ne peut pas être réauditée
        // contre une clôture passée.
        if (Object.prototype.hasOwnProperty.call(call.args || {}, 'as_of')) {
          errors.push(`${label}: overview is current-only — as_of must be omitted (the server refuses it)`);
        }
      } else if (call.args && Object.prototype.hasOwnProperty.call(call.args, 'as_of')) {
        errors.push(`${label}: as_of is supported only for the overview facet`);
      }
    }
    if (call.server === 'marketdata' && call.tool === 'GetSymbolSignals') {
      const symbol = call.args && call.args.symbol;
      if (symbol === '$item') {
        if (!call.foreach) errors.push(`${label}: GetSymbolSignals $item requires foreach`);
      } else {
        const match = typeof symbol === 'string' && symbol.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
        const constraint = match && spec.variable_constraints[match[1]];
        if (!match || !constraint || constraint.type !== 'csv' || constraint.max_items !== 1) {
          errors.push(`${label}: GetSymbolSignals is mono-symbol; use foreach or a max_items=1 variable`);
        }
      }
    }
    if (call.server === 'marketdata' && call.tool === 'QueryData' && /(^|,)bars_daily(,|$)/.test(String(call.args && call.args.types || ''))) {
      if (!call.freshness || call.freshness.expects_close !== true) errors.push(`${label}: bars_daily must declare freshness.expects_close=true`);
      if (!call.args || call.args.as_of_timestamp !== '$as_of_timestamp') errors.push(`${label}: bars_daily as_of_timestamp must equal $as_of_timestamp`);
      if (!call.args || call.args.completion_policy !== 'completed_only') errors.push(`${label}: bars_daily completion_policy must equal completed_only`);
      if (call.args && Object.prototype.hasOwnProperty.call(call.args, 'end_date')) errors.push(`${label}: bars_daily end_date is forbidden; use as_of_timestamp`);
      if (call.args && call.args.include_partial === true) errors.push(`${label}: bars_daily close gates must not request include_partial=true`);
      const calendar = call.freshness && call.freshness.asset_calendar;
      if (!['us_equity_exchange_sessions', 'crypto_24_7_utc'].includes(calendar)) {
        errors.push(`${label}: bars_daily freshness.asset_calendar must be explicit`);
      }
      const closeRef = call.freshness && call.freshness.expected_completed_end;
      const variable = typeof closeRef === 'string' && closeRef.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!variable || !declaredVars.has(variable[1])) {
        errors.push(`${label}: freshness.expected_completed_end must be a declared runtime date variable`);
      }
      const requiredRef = calendar === 'crypto_24_7_utc' ? '$crypto_completed_refdate' : equityRef;
      if (closeRef !== requiredRef) {
        errors.push(`${label}: ${calendar || 'unknown calendar'} must use expected_completed_end=${requiredRef}`);
      }
    }
    if (call.server === 'marketdata' && call.tool === 'QueryData') {
      const symbolVar = typeof call.args?.symbols === 'string' && call.args.symbols.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/);
      const constraint = symbolVar && spec.variable_constraints[symbolVar[1]];
      if (constraint && constraint.max_items > 1 && call.args.force_async !== true) {
        errors.push(`${label}: batched QueryData must set force_async=true so polling/pagination is deterministic`);
      }
    }
    if (call.server === 'systematic' && call.tool === 'DtxDecide') {
      const args = call.args || {};
      if (!['alpaca', 'trading212', 'ibkr', 'saxo'].includes(args.broker)) errors.push(`${label}: DtxDecide broker must be explicit and supported`);
      if (!['evening', 'intraday', 'manual'].includes(args.appel)) errors.push(`${label}: DtxDecide appel must be explicit`);
      if (!['alpaca', 'trading212', 'ibkr', 'saxo'].includes(args.broker)) errors.push(`${label}: DtxDecide broker must be explicit and supported`);
      if (args.expected_data_date !== equityRef) errors.push(`${label}: DtxDecide expected_data_date must equal ${equityRef}`);
      if (args.request_id !== '$request_id') errors.push(`${label}: DtxDecide request_id must equal $request_id`);
      if (args.consumer_capabilities?.contract_version !== '2.0') errors.push(`${label}: DtxDecide Contract V2 capability is required`);
      if (!Array.isArray(args.positions) || !Array.isArray(args.orders)) errors.push(`${label}: DtxDecide positions/orders must be explicit arrays`);
      if (!args.balances || typeof args.balances !== 'object' || !(Number(args.balances.total_equity) > 0)) errors.push(`${label}: DtxDecide balances must include positive total_equity`);
      if (args.balances?.broker_source !== args.broker) errors.push(`${label}: DtxDecide balances.broker_source must equal broker`);
    }
    if (call.server === 'systematic' && call.tool === 'DtxReplay') {
      if (!call.args || call.args.to !== equityRef) errors.push(`${label}: DtxReplay to must equal ${equityRef}`);
      if (call.args.equity_full !== true) errors.push(`${label}: DtxReplay must request equity_full=true`);
    }
    for (const key of ['symbol', 'symbols']) {
      if (call.args && typeof call.args[key] === 'string' && !call.args[key].includes('$') && !spec.static_symbol_calls.includes(call.as)) {
        errors.push(`${label}: fixed ${key} are forbidden here; pass a runtime variable or whitelist this benchmark call`);
      }
    }

    const allowedDates = new Set(spec.allowed_date_literals);
    for (const literal of dateLiterals(call.args || {})) {
      if (!allowedDates.has(literal)) errors.push(`${label}: hard-coded date ${literal} is forbidden`);
    }

    if (call.foreach) {
      if (!call.foreach.var || !declaredVars.has(call.foreach.var)) errors.push(`${label}: foreach.var must name a required variable`);
      if (!Number.isInteger(call.foreach.max) || call.foreach.max < 1 || call.foreach.max > 20) errors.push(`${label}: foreach.max must be an integer from 1 to 20`);
      if (!argsText.includes('$item')) errors.push(`${label}: foreach call args must reference $item`);
      const constraint = spec.variable_constraints[call.foreach.var];
      if (constraint && constraint.max_items && call.foreach.max > constraint.max_items) {
        errors.push(`${label}: foreach.max exceeds ${call.foreach.var} max_items=${constraint.max_items}`);
      }
    }
  }

  const usedVars = collectVariables({ artifact: plan.artifact, waves: plan.waves });
  usedVars.delete('item');
  usedVars.delete('as_of_timestamp');
  for (const name of usedVars) if (!declaredVars.has(name)) errors.push(`variable $${name} is used but not declared by the plan contract`);
  for (const name of spec.required_variables) if (!usedVars.has(name)) errors.push(`required variable $${name} is declared but unused`);
  for (const name of Object.keys(spec.variable_constraints)) if (!spec.required_variables.includes(name)) errors.push(`variable constraint ${name} is not a required variable`);

  return [...new Set(errors)];
}

function findPlanSpec(planPath, config = readConfig()) {
  const rel = path.relative(ROOT, path.resolve(ROOT, planPath)).replace(/\\/g, '/');
  for (const [workflow, entry] of Object.entries(config.workflows || {})) {
    for (const spec of entry.plans || []) {
      if (spec.path === rel) return { workflow, workflowSpec: entry, planSpec: spec, rel };
    }
  }
  return null;
}

function validateCommand(command, workflow, entry = {}, policy = readConfig().policy) {
  const errors = [];
  if (!command.includes(`<!-- workflow-contract: ${workflow} -->`)) {
    errors.push('command lacks workflow-contract marker');
  }
  const validator = new RegExp(`validate-workflows\\.js\\s+--workflow\\s+${workflow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  if (!validator.test(command)) errors.push(`command does not invoke validate-workflows.js --workflow ${workflow}`);

  const commandPolicy = policy.command_contract || {};
  for (const reference of commandPolicy.required_references || []) {
    if (!command.includes(reference)) errors.push(`command does not reference ${reference}`);
  }
  for (const rule of commandPolicy.forbidden_patterns || []) {
    let pattern;
    try { pattern = new RegExp(rule.pattern, 'i'); }
    catch (error) { errors.push(`invalid command policy regex ${rule.pattern}: ${error.message}`); continue; }
    if (pattern.test(command)) errors.push(rule.message || `command matches forbidden pattern ${rule.pattern}`);
  }
  const referencedTools = new Set((command.match(/\btools\/[A-Za-z0-9_./-]+/g) || [])
    .map(reference => reference.replace(/[.,;:]+$/, '')));
  for (const reference of referencedTools) {
    if (!fs.existsSync(path.join(ROOT, reference))) errors.push(`command references missing executable/resource ${reference}`);
  }
  return errors;
}

function validateCodexSkill(name, body, commandPath) {
  const errors = [];
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(name || ''))) return [`invalid Codex skill name: ${name}`];
  const frontmatterName = String(body || '').match(/^---\s*\n[\s\S]*?^name:\s*([^\s]+)\s*$/m);
  if (!frontmatterName) errors.push(`${name}: SKILL.md lacks frontmatter name`);
  else if (frontmatterName[1] !== name) errors.push(`${name}: frontmatter name is ${frontmatterName[1]}`);
  if (!String(body || '').includes(commandPath)) errors.push(`${name}: SKILL.md does not reference ${commandPath}`);
  return errors;
}

function validateConfiguredWorkflow(name, config = readConfig()) {
  const canonical = Object.entries(config.workflows || {}).find(([key, value]) => key === name || (value.aliases || []).includes(name));
  if (!canonical) return { errors: [`unknown workflow: ${name}`], plans: [] };
  const [workflow, entry] = canonical;
  const errors = [];
  const plans = [];
  const commandPath = path.join(ROOT, entry.command || '');
  if (!fs.existsSync(commandPath)) errors.push(`${workflow}: command file missing: ${entry.command}`);
  else {
    const command = fs.readFileSync(commandPath, 'utf8');
    errors.push(...validateCommand(command, workflow, entry, config.policy).map(error => `${workflow}: ${error}`));
  }
  for (const skill of entry.codex_skills || []) {
    const skillPath = path.join(ROOT, '.codex', 'skills', skill, 'SKILL.md');
    if (!fs.existsSync(skillPath)) errors.push(`${workflow}: Codex skill missing: .codex/skills/${skill}/SKILL.md`);
    else {
      const body = fs.readFileSync(skillPath, 'utf8');
      errors.push(...validateCodexSkill(skill, body, entry.command).map(error => `${workflow}: ${error}`));
    }
  }
  for (const spec of entry.plans || []) {
    const abs = path.join(ROOT, spec.path);
    if (!fs.existsSync(abs)) {
      errors.push(`${workflow}: plan missing: ${spec.path}`);
      continue;
    }
    let plan;
    try { plan = JSON.parse(fs.readFileSync(abs, 'utf8')); }
    catch (e) { errors.push(`${workflow}: invalid JSON in ${spec.path}: ${e.message}`); continue; }
    const planErrors = validatePlan(plan, spec, config.policy);
    plans.push({ path: spec.path, errors: planErrors });
    errors.push(...planErrors.map(e => `${spec.path}: ${e}`));
  }
  return { workflow, errors, plans };
}

function validateAll(config = readConfig()) {
  const reports = Object.keys(config.workflows || {}).map(name => validateConfiguredWorkflow(name, config));
  const inventoryErrors = validatePlanInventory(config);
  return { reports, inventoryErrors, errors: [...reports.flatMap(r => r.errors), ...inventoryErrors] };
}

function validatePlanInventory(config = readConfig()) {
  const tracked = spawnSync('git', ['ls-files', 'plans/*.json'], { cwd: ROOT, encoding: 'utf8' });
  if (tracked.status !== 0) return [`plan inventory unavailable: ${tracked.stderr.trim()}`];
  const configured = new Set(Object.values(config.workflows || {}).flatMap(w => (w.plans || []).map(p => p.path)));
  const errors = [];
  for (const rel of tracked.stdout.split('\n').filter(Boolean)) {
    let plan;
    try { plan = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
    catch (e) { errors.push(`${rel}: invalid JSON (${e.message})`); continue; }
    if (!Array.isArray(plan.waves)) continue; // review manifests and other non-collection JSON
    if (configured.has(rel) || plan.archived === true) continue;
    errors.push(`${rel}: active collection plan is not owned by a workflow contract`);
    if (plan.reference_date != null) errors.push(`${rel}: unconfigured active plan has literal reference_date; configure or archive it`);
    const literals = dateLiterals((plan.waves || []).map(w => w.calls || []));
    if (literals.length) errors.push(`${rel}: unconfigured active plan has hard-coded call date(s) ${[...new Set(literals)].join(', ')}; configure or archive it`);
  }
  return errors;
}

function validateRun(workflow, outDir, config = readConfig()) {
  const report = validateConfiguredWorkflow(workflow, config);
  const errors = [...report.errors];
  const out = path.resolve(ROOT, outDir);
  const harnessPath = path.join(out, 'harness.json');
  const journalPath = path.join(out, '_collect.json');
  let harness;
  let journal;
  try { harness = JSON.parse(fs.readFileSync(harnessPath, 'utf8')); }
  catch (e) { return { errors: [...errors, `run harness missing/invalid: ${e.message}`] }; }
  try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); }
  catch (e) { return { errors: [...errors, `run journal missing/invalid: ${e.message}`] }; }

  if (harness.contract_version !== '1.0') errors.push('harness contract_version must be 1.0');
  if (!harness.plan_sha256 || !journal.plan_sha256 || harness.plan_sha256 !== journal.plan_sha256) errors.push('plan hash missing or inconsistent');
  if (!harness.input_sha256 || !journal.input_sha256 || harness.input_sha256 !== journal.input_sha256) errors.push('input hash missing or inconsistent');
  if (!harness.artifact || UNRESOLVED_RE.test(harness.artifact)) errors.push(`artifact is unresolved: ${harness.artifact || '(missing)'}`);
  if (!harness.reference_close) errors.push('reference_close is missing');
  if (journal.failures !== 0) errors.push(`collection journal reports ${journal.failures} failure(s)`);
  if (journal.blocked_at_gate) errors.push(`collection stopped at gate ${journal.blocked_at_gate}`);
  if (!Number.isInteger(journal.executed_calls) || journal.executed_calls < 1) errors.push('journal executed_calls is missing or invalid');
  if (journal.skipped_calls !== 0) errors.push(`collection skipped ${journal.skipped_calls ?? 'unknown'} planned call(s)`);
  const loggedCalls = (journal.waves || []).flatMap(w => w.calls || []);
  for (const call of loggedCalls) {
    if (call.ok === false && call.required !== false) errors.push(`required call failed: ${call.as || call.tool || '?'}`);
  }
  if (!Array.isArray(harness.sources) || !harness.sources.length) errors.push('harness has no sources');
  for (const source of harness.sources || []) {
    const sourceFile = path.join(out, `${source.name}.json`);
    if (source.required !== false && (!fs.existsSync(sourceFile) || fs.statSync(sourceFile).size === 0)) {
      errors.push(`required source artifact missing: ${source.name}.json`);
    } else if (!/^[a-f0-9]{64}$/.test(String(source.sha256 || ''))) {
      errors.push(`source hash missing/invalid: ${source.name}`);
    } else if (sha256(fs.readFileSync(sourceFile)) !== source.sha256) {
      errors.push(`source hash mismatch: ${source.name}.json`);
    }
  }
  const successfulCalls = loggedCalls.filter(call => call.ok === true).length;
  if (Array.isArray(harness.sources) && harness.sources.length !== successfulCalls) {
    errors.push(`harness/source count ${harness.sources.length} does not match ${successfulCalls} successful calls`);
  }
  const planPath = journal.plan && path.resolve(ROOT, journal.plan);
  if (!planPath || !fs.existsSync(planPath)) errors.push(`journal plan is unavailable: ${journal.plan || '(missing)'}`);
  else if (sha256(fs.readFileSync(planPath)) !== harness.plan_sha256) errors.push('plan changed after collection');
  const owner = journal.plan && findPlanSpec(journal.plan, config);
  const canonical = report.workflow || workflow;
  if (!owner || (owner.workflow !== canonical && !(owner.workflow === 'signals-desk' && canonical === 'signals-desk-fire-and-forget'))) {
    errors.push(`plan ${journal.plan || '(missing)'} does not belong to workflow ${canonical}`);
  }
  return { workflow: canonical, harness: harnessPath, journal: journalPath, errors };
}

module.exports = {
  ROOT,
  CONFIG_PATH,
  UNRESOLVED_RE,
  allCalls,
  collectVariables,
  findPlanSpec,
  readConfig,
  sha256,
  stableStringify,
  validateAll,
  validateCodexSkill,
  validateCommand,
  validateConfiguredWorkflow,
  validatePlanInventory,
  validatePlan,
  validateRuntimeVariables,
  validateRun,
};
