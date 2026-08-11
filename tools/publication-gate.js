#!/usr/bin/env node
'use strict';
/**
 * publication-gate — décide SI et COMMENT un contenu sort, et surtout s'il mérite
 * un EMAIL.
 *
 *   node tools/publication-gate.js --check <type> [--materiality N] [--json]
 *   node tools/publication-gate.js --record <type> --channels web,telegram[,email]
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * Un email part chez de vrais abonnés et ne se rattrape pas. Le 10 août, deux
 * emails sont partis dans la journée, dont un portant une thèse que la relecture
 * a ensuite démolie. Le web se corrige, un email non.
 *
 * D'où l'inversion de la valeur par défaut : **Substack publie SANS email**
 * (`send_email=false`, la page existe, personne n'est réveillé). L'email est
 * l'EXCEPTION, à mériter.
 *
 * ── Trois barrières cumulatives ─────────────────────────────────────────────
 * 1. CADENCE — chaque type a sa fréquence propre. Un daily deux fois dans la
 *    journée, un weekly deux fois dans la semaine : refusés.
 * 2. QUOTA EMAIL — au plus 1 email par 24 h, TOUS types confondus. C'est la
 *    règle anti-spam demandée : pas « un par type », un tout court.
 * 3. MATÉRIALITÉ — l'email exige un score ≥ 70/100 que l'appelant doit justifier.
 *    Sans justification chiffrée, pas d'email.
 *
 * Web et Telegram ne sont pas soumis au quota : ce sont des canaux qu'on consulte,
 * pas des canaux qui interrompent.
 */
const fs = require('fs');
const LEDGER = 'data/publication-ledger.json';

const CADENCE_H = {
  daily: 20,      // un par séance, marge de 4 h pour les runs décalés
  weekly: 144,    // 6 jours
  scanner: 12,    // une session de marché
  analyse: 0,     // à la demande, pas de cadence imposée
  retro: 144,
  rotation: 144,
  insiders: 20,
  earnings: 20,
  signals: 12,
};
const EMAIL_MIN_MATERIALITY = 70;
const EMAIL_COOLDOWN_H = 24;

function load() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); }
  catch { return { entries: [] }; }
}
function hoursSince(iso) { return (Date.now() - Date.parse(iso)) / 3600000; }

function check(type, materiality) {
  const led = load();
  const now = new Date().toISOString();
  const reasons = [];
  const of = t => led.entries.filter(e => e.type === t).sort((a, b) => b.at.localeCompare(a.at))[0];

  // 1. cadence
  const last = of(type);
  const cad = CADENCE_H[type] != null ? CADENCE_H[type] : 0;
  let publish = true;
  if (last && cad > 0 && hoursSince(last.at) < cad) {
    publish = false;
    reasons.push(`cadence : « ${type} » publié il y a ${hoursSince(last.at).toFixed(1)} h, minimum ${cad} h`);
  }

  // 2. quota email — tous types confondus
  const lastEmail = led.entries
    .filter(e => (e.channels || []).includes('email'))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  let email = true;
  if (lastEmail && hoursSince(lastEmail.at) < EMAIL_COOLDOWN_H) {
    email = false;
    reasons.push(`quota email : dernier envoi il y a ${hoursSince(lastEmail.at).toFixed(1)} h (« ${lastEmail.type} »), minimum ${EMAIL_COOLDOWN_H} h — TOUS types confondus`);
  }

  // 3. matérialité
  const m = Number.isFinite(materiality) ? materiality : null;
  if (m == null) {
    email = false;
    reasons.push('matérialité non fournie — un email exige une justification chiffrée (--materiality N)');
  } else if (m < EMAIL_MIN_MATERIALITY) {
    email = false;
    reasons.push(`matérialité ${m}/100 < ${EMAIL_MIN_MATERIALITY} — publier sur le web sans réveiller personne`);
  }
  if (!publish) email = false;

  return {
    type, publish_web: publish, send_email: email,
    telegram: publish,           // même cadence que le web, pas de quota
    materiality: m, reasons,
    checked_at: now,
    hint: email
      ? 'Email AUTORISÉ. Dernière question avant d\'envoyer : accepterais-tu de le recevoir toi-même ?'
      : 'Publier avec send_email=false. La page existe, elle est partageable, et personne n\'est interrompu.',
  };
}

function record(type, channels) {
  const led = load();
  led.entries.push({ type, at: new Date().toISOString(), channels });
  led.entries = led.entries.slice(-500);
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2));
  console.log(`[gate] enregistré : ${type} → ${channels.join(', ')}`);
}

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };

if (argv.includes('--record')) {
  const type = arg('--record');
  const ch = (arg('--channels', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!type || !ch.length) { console.error('Usage: --record <type> --channels web,telegram[,email]'); process.exit(2); }
  record(type, ch);
} else {
  const type = arg('--check');
  if (!type) { console.error('Usage: --check <type> [--materiality N] [--json]'); process.exit(2); }
  const r = check(type, Number(arg('--materiality', NaN)));
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log(`type            ${r.type}`);
    console.log(`web             ${r.publish_web ? 'OUI' : 'NON'}`);
    console.log(`telegram        ${r.telegram ? 'OUI' : 'NON'}`);
    console.log(`email           ${r.send_email ? 'OUI' : 'NON'}`);
    if (r.reasons.length) { console.log('motifs :'); for (const x of r.reasons) console.log('  · ' + x); }
    console.log('→ ' + r.hint);
  }
  process.exit(r.publish_web ? 0 : 1);
}
