#!/usr/bin/env node
'use strict';
/**
 * email-grant-guard — hook PreToolUse. Le mur local devant `publish`.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * Le garde-fou email n'avait aucun point d'application. `publish(draft_id,
 * send_email=true)` est un booléen dans un appel d'outil : rien n'obligeait à
 * consulter `publication-gate.js` avant de le poser, et le harnais encourage
 * explicitement à grouper les appels indépendants dans un même bloc. Le
 * dispositif complet gardait donc une porte sans mur — exactement l'incident du
 * 10 août, reproductible malgré tout ce qui était écrit autour.
 *
 * Ce hook est le mur. Il s'interpose AVANT l'appel, et il ne lit pas de la
 * prose : il consomme un jeton à usage unique émis par le gate sous verrou,
 * après consommation du quota. Pas de jeton → deny, et l'email ne part pas.
 *
 * Un `send_email` absent ou faux n'est jamais gêné : le chemin normal (publier
 * sur le web sans réveiller personne) reste silencieux et sans friction.
 *
 * Branché dans .claude/settings.json, matcher : mcp__substack__publish
 */
const { consume } = require('../lib/email-grant');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}
const allow = () => process.exit(0);   // silence = on ne s'en mêle pas

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { buf += d; });
process.stdin.on('end', () => {
  let ev;
  // Un hook qui casse ne doit pas bloquer tout le travail du desk ; mais il ne
  // doit pas non plus laisser passer un envoi. On ne peut pas avoir les deux :
  // sur entrée illisible on LAISSE PASSER uniquement parce qu'on n'a alors même
  // pas établi qu'il s'agit d'un envoi email. Le refus, lui, est décidé sur des
  // champs qu'on a réellement lus.
  try { ev = JSON.parse(buf || '{}'); } catch { allow(); return; }

  const tool = String(ev.tool_name || '');
  const input = ev.tool_input || {};
  if (!/publish/i.test(tool)) allow();

  // Tolérant sur la forme : `true`, `"true"`, `1` sont tous des envois. Une
  // comparaison stricte à `true` aurait laissé passer la chaîne "true".
  const v = input.send_email;
  const wantsEmail = v === true || v === 1 || String(v).toLowerCase() === 'true';
  if (!wantsEmail) allow();

  const r = consume('*', 'hook');
  if (!r.ok) deny(r.reason);

  // Autorisé : on laisse la décision de permission au flux normal, en ayant
  // dépensé le jeton. Le quota était déjà brûlé au moment de l'émission — si
  // l'envoi échoue maintenant, l'email autorisé est perdu, et c'est le bon sens
  // de l'échec.
  process.stderr.write(`[email-grant] jeton ${r.nonce} consommé (émis pour « ${r.type} », matérialité ${r.materiality}/100).\n`);
  allow();
});
