#!/usr/bin/env node
'use strict';
/**
 * publication-gate — décide SI et COMMENT un contenu sort, et surtout s'il mérite
 * un EMAIL.
 *
 *   node tools/publication-gate.js --check <type> [--json]
 *   node tools/publication-gate.js --record <type> --channels web,telegram
 *   node tools/publication-gate.js --authorize <type> --materiality N --evidence "…"
 *   node tools/publication-gate.js --compact          (maintenance hors ligne)
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
 * 3. MATÉRIALITÉ — l'email exige un score ENTIER 0-100 ≥ 70 **et** une
 *    justification écrite, tous deux PERSISTÉS dans le registre. Une barrière
 *    qui ne laisse aucune trace n'est pas auditable : trois mois plus tard,
 *    « pourquoi cet email est-il parti ? » n'a plus de réponse.
 *
 * ── Décider et enregistrer sont le MÊME geste ───────────────────────────────
 * `--check` ne délivre AUCUNE autorisation : il n'écrit rien, donc deux appels
 * successifs répondaient oui deux fois et le double envoi ne demandait même pas
 * une course. Seul `--authorize` autorise, et il le fait sous verrou, dans un
 * seul processus : vérification, consommation du quota et émission du jeton à
 * usage unique sont indissociables. Le jeton (tools/lib/email-grant.js) est ce
 * qui rend le refus EXÉCUTOIRE au point d'envoi — le reste n'est que du conseil.
 *
 * ── Le registre est APPEND-ONLY (NDJSON) ────────────────────────────────────
 * Une ligne JSON par publication, ajoutée par `appendFileSync` (O_APPEND). Le
 * read-modify-write précédent perdait des écritures dès que deux produits
 * étaient enregistrés en parallèle — 4 entrées sur 20 survivaient — et un
 * produit dont l'entrée disparaît est réputé jamais publié, donc republié le
 * lendemain. En prime, deux clones du dépôt fusionnent leurs registres par
 * union de lignes (.gitattributes) au lieu de produire un conflit qui casse
 * l'enregistrement tout en laissant la publication passer.
 *
 * Web et Telegram ne sont pas soumis au quota : ce sont des canaux qu'on consulte,
 * pas des canaux qui interrompent.
 */
const fs = require('fs');
const path = require('path');
const { mint } = require('./lib/email-grant');

// Chemins ANCRÉS SUR LE DÉPÔT, jamais sur le répertoire courant. Un chemin relatif
// faisait du quota une passoire : `cd tools && node publication-gate.js --check
// weekly` lisait un registre vide. Les sous-agents et les routines cloud n'ont
// aucune raison de partager le cwd de l'opérateur.
const DATA = path.join(__dirname, '..', 'data');
const LEDGER = path.join(DATA, 'publication-ledger.ndjson');
const LEGACY = path.join(DATA, 'publication-ledger.json');   // ancien format, lu s'il traîne
const LOCK = path.join(DATA, 'desk', '.email.lock');

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
const EVIDENCE_MIN_CHARS = 120;

/**
 * Lecture du registre. « Absent » et « illisible » sont deux choses DIFFÉRENTES
 * et les confondre ouvrait le quota : un fichier tronqué était traité comme
 * « rien n'a jamais été publié », donc email libre. Absent = premier run,
 * légitime. Illisible = on ne sait pas, donc on refuse.
 *
 * Une ligne illisible ne condamne pas les autres : on garde ce qu'on a su lire
 * ET on lève le drapeau. Le quota reste alors fermé, mais le web n'est pas
 * paralysé par une ligne abîmée vieille de trois semaines.
 */
function load() {
  const entries = [];
  const problems = [];

  // Ancien format monolithique : lu tant qu'il existe, pour qu'une migration ne
  // remette pas le quota à zéro. Jamais réécrit.
  try {
    const d = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
    if (d && Array.isArray(d.entries)) entries.push(...d.entries);
    else problems.push('registre hérité malformé (pas de tableau « entries »)');
  } catch (e) {
    if (e.code !== 'ENOENT') problems.push(`registre hérité illisible (${e.code || e.message})`);
  }

  let raw = null;
  try { raw = fs.readFileSync(LEDGER, 'utf8'); }
  catch (e) { if (e.code !== 'ENOENT') problems.push(`registre illisible (${e.code})`); }

  if (raw != null) {
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      // Marqueur de conflit git : le registre a divergé entre deux clones. On ne
      // devine pas — on refuse l'email et on le dit.
      if (/^(<{7}|={7}|>{7}|\|{7})/.test(l)) { problems.push(`conflit git non résolu ligne ${i + 1} de ${path.basename(LEDGER)}`); continue; }
      try {
        const e = JSON.parse(l);
        if (e && typeof e === 'object') entries.push(e); else problems.push(`ligne ${i + 1} : entrée non-objet`);
      } catch { problems.push(`ligne ${i + 1} illisible`); }
    }
  }
  return { entries, unreadable: problems.length ? problems.join(' ; ') : false };
}

// Les canaux sont normalisés PARTOUT (ici et dans desk-run.sh). Sans ça,
// « EMAIL » passait le garde-fou de desk-run ET échappait au quota : l'envoi
// était consigné, le compteur ne le voyait pas, et le suivant repartait.
const normChannels = (a) => (Array.isArray(a) ? a : []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
function hoursSince(iso) { return (Date.now() - Date.parse(iso)) / 3600000; }

function check(type, materiality) {
  const led = load();
  const now = new Date().toISOString();
  // Deux registres de motifs SÉPARÉS. Les mélanger faisait afficher « matérialité
  // non fournie » comme raison pour laquelle un daily n'était pas dû sur le web,
  // ce qui n'a aucun rapport et brouille la lecture du plan.
  const webReasons = [], emailReasons = [];
  const of = t => led.entries.filter(e => e.type === t && e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];

  // 1. cadence
  const last = of(type);
  const cad = CADENCE_H[type] != null ? CADENCE_H[type] : 0;
  let publish = true;
  if (last && cad > 0 && hoursSince(last.at) < cad) {
    publish = false;
    webReasons.push(`cadence : « ${type} » publié il y a ${hoursSince(last.at).toFixed(1)} h, minimum ${cad} h`);
  }

  // 2. quota email — tous types confondus
  let email = true;
  if (led.unreadable) {
    // On ne sait PAS ce qui est déjà parti. Un email ne se rattrape pas : dans le
    // doute, on ne l'envoie pas. Le web, lui, reste ouvert — il se corrige.
    email = false;
    emailReasons.push(`${led.unreadable} — impossible de savoir si un email est déjà parti dans les ${EMAIL_COOLDOWN_H} h. Refus par défaut : réparer ${path.basename(LEDGER)} avant de réessayer.`);
  }
  const emailEntries = led.entries.filter(e => normChannels(e.channels).includes('email'));
  // Une entrée email dont la date est illisible n'est PAS une entrée absente :
  // `hoursSince` renvoyait NaN, `NaN < 24` valait false, et l'entrée devenait
  // invisible pour le quota. On la traite comme bloquante.
  const undated = emailEntries.filter(e => !Number.isFinite(hoursSince(e.at)));
  if (undated.length) {
    email = false;
    emailReasons.push(`${undated.length} envoi(s) email à date illisible dans le registre — antériorité indéterminable, refus par défaut`);
  }
  const lastEmail = emailEntries
    .filter(e => Number.isFinite(hoursSince(e.at)))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (lastEmail && hoursSince(lastEmail.at) < EMAIL_COOLDOWN_H) {
    email = false;
    emailReasons.push(`quota email : dernier envoi il y a ${hoursSince(lastEmail.at).toFixed(1)} h (« ${lastEmail.type} »), minimum ${EMAIL_COOLDOWN_H} h — TOUS types confondus`);
  }

  // 3. matérialité — bornée. Un score non borné n'est pas une barrière : 999999
  //    passait, ce qui montre bien que le nombre ne mesurait rien.
  const m = Number.isFinite(materiality) ? materiality : null;
  if (m == null) {
    email = false;
    emailReasons.push('matérialité non fournie — un email exige une justification chiffrée (--materiality N, entier 0-100)');
  } else if (!Number.isInteger(m) || m < 0 || m > 100) {
    email = false;
    emailReasons.push(`matérialité « ${materiality} » hors barème — attendu : entier entre 0 et 100`);
  } else if (m < EMAIL_MIN_MATERIALITY) {
    email = false;
    emailReasons.push(`matérialité ${m}/100 < ${EMAIL_MIN_MATERIALITY} — publier sur le web sans réveiller personne`);
  }
  if (!publish) { email = false; emailReasons.push('publication web refusée — pas d\'email sur un contenu qui ne sort pas'); }

  const reasons = [...webReasons, ...emailReasons];
  return {
    web_reasons: webReasons, email_reasons: emailReasons,
    // cadence_h exposé pour que l'appelant sache DISTINGUER « barrière franchie »
    // de « barrière inexistante ». Un type absent de CADENCE_H sort à 0 : le gate
    // dira toujours oui, ce qui n'est pas une autorisation mais un trou de config.
    type, cadence_h: cad, last_published_at: (last && last.at) || null,
    publish_web: publish,
    // `email_eligible`, PAS `send_email`. Ce champ ne dit pas « envoie » : il dit
    // « rien dans le registre ne s'y oppose À CET INSTANT ». Il a été renommé
    // parce que `send_email:true` sorti d'un chemin qui n'enregistre rien se
    // lisait comme un feu vert, et qu'on pouvait en obtenir deux dans la même
    // minute pour deux produits différents.
    email_eligible: email,
    // Conservé à false EN DUR : aucun appelant ne doit pouvoir dériver un envoi
    // depuis la sortie de --check. L'envoi exige un jeton, pas un booléen.
    send_email: false,
    telegram: publish,           // même cadence que le web, pas de quota
    materiality: m, reasons,
    checked_at: now,
    hint: email
      ? 'ÉLIGIBLE — et ceci n\'est PAS une autorisation. Aucune ligne n\'a été écrite, aucun quota consommé. '
        + 'Seul  bash tools/desk-run.sh --authorize-email <type> --materiality N --evidence "…"  autorise, '
        + 'sous verrou, en consommant le quota et en émettant le jeton à usage unique sans lequel l\'envoi est refusé.'
      : 'Publier avec send_email=false. La page existe, elle est partageable, et personne n\'est interrompu.',
  };
}

/** Ajout append-only. Une ligne, un appel, aucune relecture : rien à perdre. */
function append(entry) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  const line = JSON.stringify(entry).replace(/\n/g, ' ') + '\n';
  fs.appendFileSync(LEDGER, line);
}

function record(type, channels, extra) {
  const ch = normChannels(channels);
  append({ type, at: new Date().toISOString(), channels: ch, ...(extra || {}) });
  console.log(`[gate] enregistré : ${type} → ${ch.join(', ')}`);
}

// ── Verrou. mkdir est atomique sur tous les systèmes de fichiers qui nous
// intéressent. Il enveloppe vérification ET enregistrement DANS LE MÊME
// PROCESSUS : c'est la seule façon d'empêcher deux produits de lire tous les
// deux un quota libre. Un verrou pris dans un script appelant, autour d'un autre
// processus qui décide, ne protège rien de ce que le décideur expose par
// ailleurs.
function withLock(fn) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  // Verrou périmé (> 5 min) = un run tué au mauvais moment, pas une course. La
  // levée passe par `rename` : rmdir suivi de mkdir n'est PAS atomique, et deux
  // processus voyant le même verrou périmé pouvaient tous deux le casser puis
  // tous deux l'acquérir. Un rename ne réussit qu'une fois.
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs > 5 * 60 * 1000) {
      const stale = `${LOCK}.stale.${process.pid}`;
      try { fs.renameSync(LOCK, stale); fs.rmSync(stale, { recursive: true, force: true }); } catch {}
    }
  } catch { /* pas de verrou, tant mieux */ }
  try { fs.mkdirSync(LOCK); }
  catch (e) {
    if (e.code === 'EEXIST') { console.error('[gate] verrou email déjà pris — un autre produit est en train de décider. Réessayer après lui, jamais en parallèle.'); process.exit(5); }
    throw e;
  }
  // ⚠️ `fn` ne doit JAMAIS appeler process.exit : `process.exit` court-circuite
  // le `finally`, le verrou survit à un refus et bloque les 5 minutes suivantes.
  // fn renvoie donc un verdict, et la sortie se fait APRÈS la libération.
  try { return fn(); }
  finally { try { fs.rmdirSync(LOCK); } catch {} }
}

/**
 * SEUL chemin qui autorise un email. Vérifie, consomme le quota et émet le jeton
 * dans un seul processus, sous verrou.
 *
 * ON BRÛLE LE QUOTA AVANT D'ENVOYER, jamais après. Si l'envoi échoue, on a perdu
 * un email autorisé — c'est le bon sens de l'échec. L'ordre inverse laisse une
 * fenêtre où un second produit voit le quota encore libre.
 */
function authorize(type, materiality, evidence) {
  const verdict = withLock(() => {
    const r = check(type, materiality);
    if (!r.email_eligible) return { code: 1, refus: r.email_reasons, detail: r };
    const ev = String(evidence || '').trim();
    if (ev.length < EVIDENCE_MIN_CHARS) {
      return { code: 2, refus: [`--evidence manquante ou trop courte (${ev.length} caractères, minimum ${EVIDENCE_MIN_CHARS}).`
        + ' Un score seul ne justifie rien : il est choisi par la partie qui a intérêt à envoyer.'
        + ' Écrire ce qui rend ce contenu digne d\'interrompre quelqu\'un — le fait, le chiffre, l\'écart au consensus.'] };
    }
    // Le registre d'abord, le jeton ensuite : un jeton sans ligne de registre
    // serait un envoi que le quota ne verrait jamais.
    record(type, ['web', 'telegram', 'email'], { materiality, materiality_evidence: ev });
    return { code: 0, grant: mint(type, { materiality, materiality_evidence: ev }) };
  });

  if (verdict.code !== 0) {
    console.error(`[gate] email REFUSÉ pour « ${type} » :\n  · ${verdict.refus.join('\n  · ')}`);
    console.error('  → publier avec send_email=false. La page existe, elle est partageable, personne n\'est réveillé.');
    process.exit(verdict.code);
  }
  const g = verdict.grant;
  console.log(`[gate] EMAIL AUTORISÉ pour « ${type} » (matérialité ${materiality}/100). Quota consommé AVANT l'envoi.`);
  console.log(`[gate] jeton à usage unique ${g.nonce} — valable ${g.ttl_minutes} min (jusqu'à ${g.expires_at}).`);
  console.log('Dernière question avant d\'envoyer : accepterais-tu de le recevoir toi-même ?');
  return g;
}

/**
 * Compaction HORS LIGNE, jamais dans le chemin d'écriture. Élaguer pendant qu'on
 * enregistre, c'était réécrire tout le fichier à chaque publication — la source
 * même des écritures perdues. Les envois email ne sont JAMAIS élagués : le quota
 * doit pouvoir les voir même après une journée bavarde.
 */
function compact() {
  const led = load();
  if (led.unreadable) { console.error(`[gate] ${led.unreadable} — compaction refusée : on ne réécrit pas un registre qu'on n'a pas su lire.`); process.exit(4); }
  const sorted = led.entries.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const emails = sorted.filter(e => normChannels(e.channels).includes('email'));
  const rest = sorted.filter(e => !normChannels(e.channels).includes('email'));
  const kept = [...emails.slice(-200), ...rest.slice(-800)].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const tmp = `${LEDGER}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, kept.map(e => JSON.stringify(e)).join('\n') + '\n');
  fs.renameSync(tmp, LEDGER);
  if (fs.existsSync(LEGACY)) { fs.renameSync(LEGACY, `${LEGACY}.migrated`); console.log(`[gate] registre hérité absorbé → ${path.basename(LEGACY)}.migrated`); }
  console.log(`[gate] compacté : ${led.entries.length} → ${kept.length} entrée(s).`);
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// Codes de sortie, et ils ne se recouvrent pas :
//   --check      0 = WEB autorisé, 1 = WEB refusé. Ne dit RIEN de l'email —
//                `--check && envoyer_email` était un faux ami qui envoyait dès
//                que le web était ouvert.
//   --authorize  0 = email autorisé (jeton émis), 1 = refusé, 2 = usage,
//                5 = verrou pris.
//   --record     0 = écrit, 2 = usage, 4 = canal email refusé.
const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };

if (argv.includes('--compact')) {
  compact();
} else if (argv.includes('--authorize')) {
  const type = arg('--authorize');
  const rawM = arg('--materiality', '');
  const m = /^-?\d+$/.test(String(rawM).trim()) ? Number(rawM) : NaN;
  if (!type) { console.error('Usage: --authorize <type> --materiality N --evidence "<justification>"'); process.exit(2); }
  if (!Number.isFinite(m)) { console.error('[gate] --materiality N requis : entier 0-100. Un email sans justification chiffrée n\'est pas un email autorisé.'); process.exit(2); }
  authorize(type, m, arg('--evidence', arg('--materiality-evidence', '')));
} else if (argv.includes('--record')) {
  const type = arg('--record');
  const ch = normChannels((arg('--channels', '') || '').split(','));
  if (!type || !ch.length) { console.error('Usage: --record <type> --channels web,telegram'); process.exit(2); }
  // Un email ne s'enregistre PAS par ce chemin, et il n'existe plus de drapeau
  // pour le permettre. `--authorized` était une chaîne d'argv que n'importe quel
  // appelant pouvait poser : on pouvait forger une ligne email sans matérialité
  // ni quota, donc bloquer un envoi légitime pendant 24 h, et surtout on ne
  // pouvait plus rien déduire d'une ligne email lue dans le registre. Désormais
  // l'écriture d'une ligne email n'existe QUE dans authorize(), sous verrou,
  // après vérification — l'invariant tient sans rien demander à l'appelant.
  if (ch.includes('email')) {
    console.error('[gate] refus : un canal « email » ne s\'enregistre que via  node tools/publication-gate.js --authorize <type> --materiality N --evidence "…"  (matérialité + quota vérifiés sous verrou, jeton émis).');
    process.exit(4);
  }
  record(type, ch);
} else {
  const type = arg('--check');
  if (!type) { console.error('Usage: --check <type> [--materiality N] [--json]'); process.exit(2); }
  const rawM = arg('--materiality', '');
  const m = /^-?\d+$/.test(String(rawM).trim()) ? Number(rawM) : Number(arg('--materiality', NaN));
  const r = check(type, m);
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log(`type            ${r.type}`);
    console.log(`web             ${r.publish_web ? 'OUI' : 'NON'}`);
    console.log(`telegram        ${r.telegram ? 'OUI' : 'NON'}`);
    console.log(`email           ${r.email_eligible ? 'ÉLIGIBLE (pas autorisé)' : 'NON'}`);
    if (r.web_reasons.length) { console.log('motifs web :'); for (const x of r.web_reasons) console.log('  · ' + x); }
    if (r.email_reasons.length) { console.log('motifs email :'); for (const x of r.email_reasons) console.log('  · ' + x); }
    console.log('→ ' + r.hint);
  }
  process.exit(r.publish_web ? 0 : 1);
}
