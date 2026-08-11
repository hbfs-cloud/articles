'use strict';
/**
 * email-grant — le MUR à côté de la porte.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * `publication-gate.js` savait dire non. Il ne pouvait pas EMPÊCHER. Rien
 * n'obligeait qui que ce soit à lui demander son avis : `publish(draft_id,
 * send_email=true)` est un booléen, et un booléen ne consulte pas un registre.
 * Les trois barrières gardaient donc une porte à côté de laquelle il n'y avait
 * pas de mur.
 *
 * Ce module est le mur. L'autorisation n'est plus une phrase imprimée sur un
 * terminal — c'est un JETON À USAGE UNIQUE sur disque, émis par le gate sous
 * verrou après consommation du quota, et CONSOMMÉ par le point d'envoi. Pas de
 * jeton valide = pas d'email, quel que soit l'appelant et quelle que soit sa
 * bonne foi.
 *
 * ── Deux consommateurs, une seule dépense ───────────────────────────────────
 * Le jeton est vérifié à deux endroits :
 *   · le hook PreToolUse local, avant que l'appel `publish` ne parte ;
 *   · le handler `publish` du serveur substack, quand il tourne près du dépôt.
 * Les deux consomment. Pour que le second ne rejette pas ce que le premier vient
 * légitimement de dépenser, un jeton consommé reste re-consommable pendant
 * HANDOFF_MS, mais UNIQUEMENT par un rôle différent, et une seule fois par rôle.
 * Deux envois ne peuvent donc pas partager un jeton : le second envoi présente
 * le même rôle que le premier et se fait refuser.
 *
 * ── Durée de vie ────────────────────────────────────────────────────────────
 * 10 minutes. Une autorisation obtenue le matin ne doit pas pouvoir servir le
 * soir : la matérialité qui la justifiait a une date de péremption, et le quota
 * a déjà été brûlé de toute façon.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000;        // validité d'un jeton neuf
const HANDOFF_MS = 2 * 60 * 1000;     // fenêtre de relais hook → serveur
const PREFIX = '.email-grant.';

// Ancré sur le dépôt, jamais sur le cwd — sinon le jeton se cherche là où
// personne ne l'a écrit, et l'enforcement devient un refus permanent (ou pire,
// un dossier vide qu'on crée à côté). L'override sert au serveur substack, qui
// tourne dans son propre paquet.
function grantDir() {
  return process.env.DESK_EMAIL_GRANT_DIR || path.join(__dirname, '..', '..', 'data', 'desk');
}

function readGrant(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Ménage : jetons périmés et reliquats de relais. Sans balayage, le dossier
 *  accumule des `.used` dont la seule lecture ralentit la vérification. */
function sweep(dir) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  const now = Date.now();
  for (const n of names) {
    if (!n.startsWith(PREFIX)) continue;
    const f = path.join(dir, n);
    let st; try { st = fs.statSync(f); } catch { continue; }
    const age = now - st.mtimeMs;
    if (n.endsWith('.used') ? age > HANDOFF_MS * 5 : age > TTL_MS) {
      try { fs.unlinkSync(f); } catch { /* concurrent, tant mieux */ }
    }
  }
}

/**
 * Émet un jeton. N'est appelé QUE par publication-gate.js --authorize, après
 * vérification des trois barrières ET après écriture de la ligne de registre :
 * le quota est brûlé avant que le jeton n'existe, jamais après.
 */
function mint(type, meta) {
  const dir = grantDir();
  fs.mkdirSync(dir, { recursive: true });
  sweep(dir);
  const nonce = crypto.randomBytes(12).toString('hex');
  const file = path.join(dir, PREFIX + nonce);
  const body = {
    type, nonce,
    minted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    consumed_by: [],
    ...(meta || {}),
  };
  // wx : on n'écrase jamais un jeton existant. Une collision de nonce est
  // improbable ; la traiter comme une erreur coûte moins cher que d'écraser
  // silencieusement une autorisation en cours de relais.
  fs.writeFileSync(file, JSON.stringify(body, null, 2), { flag: 'wx' });
  return { nonce, file, expires_at: body.expires_at, ttl_minutes: TTL_MS / 60000 };
}

/**
 * Consomme un jeton pour `type` au nom de `role`. `type === '*'` accepte
 * n'importe quel type : le point d'envoi ne connaît qu'un `draft_id`, il ne sait
 * pas de quel produit il s'agit. Ce n'est pas un trou — le quota est global (1
 * email / 24 h tous types confondus), donc un jeton reste un envoi et un seul.
 * @returns {{ok:true,nonce:string,materiality:number,type:string}|{ok:false,reason:string}}
 *
 * La revendication passe par un `rename`, qui ne réussit qu'une fois : deux
 * processus qui voient le même jeton libre ne peuvent pas le dépenser tous les
 * deux. Le perdant échoue sur ENOENT et poursuit sa boucle.
 */
function consume(type, role) {
  const dir = grantDir();
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return { ok: false, reason: `aucun jeton d'autorisation (dossier ${dir} absent)` }; }
  const now = Date.now();
  const fresh = names.filter(n => n.startsWith(PREFIX) && !n.endsWith('.used')).sort();
  let expired = 0, wrongType = 0;

  for (const n of fresh) {
    const f = path.join(dir, n);
    const g = readGrant(f);
    if (!g) continue;
    if (Date.parse(g.expires_at) < now) { expired++; try { fs.unlinkSync(f); } catch {} continue; }
    if (type !== '*' && g.type !== type) { wrongType++; continue; }
    const used = f + '.used';
    try { fs.renameSync(f, used); } catch { continue; }   // revendiqué par un autre
    g.consumed_by = [role];
    g.consumed_at = new Date().toISOString();
    try { fs.writeFileSync(used, JSON.stringify(g, null, 2)); } catch {}
    return { ok: true, nonce: g.nonce, materiality: g.materiality, type: g.type };
  }

  // Relais : le hook vient de dépenser le jeton pour CET appel, le serveur le
  // revoit une seconde plus tard. Autorisé une fois par rôle, jamais deux.
  for (const n of names.filter(x => x.startsWith(PREFIX) && x.endsWith('.used')).sort()) {
    const f = path.join(dir, n);
    const g = readGrant(f);
    if (!g || (type !== '*' && g.type !== type)) continue;
    let st; try { st = fs.statSync(f); } catch { continue; }
    if (now - st.mtimeMs > HANDOFF_MS) continue;
    const by = Array.isArray(g.consumed_by) ? g.consumed_by : [];
    if (by.includes(role)) continue;             // même rôle = second envoi, refusé
    g.consumed_by = by.concat([role]);
    g.consumed_at = new Date().toISOString();
    try { fs.writeFileSync(f, JSON.stringify(g, null, 2)); } catch { continue; }
    return { ok: true, nonce: g.nonce, materiality: g.materiality, type: g.type, handoff: true };
  }

  const detail = [];
  if (expired) detail.push(`${expired} jeton(s) périmé(s)`);
  if (wrongType) detail.push(`${wrongType} jeton(s) pour un autre type`);
  const what = type === '*' ? 'cet envoi' : `« ${type} »`;
  return {
    ok: false,
    reason: `email NON AUTORISÉ pour ${what}${detail.length ? ` (${detail.join(', ')})` : ''}. `
      + 'Un email exige un jeton à usage unique, émis sous verrou après consommation du quota :\n'
      + `  bash tools/desk-run.sh --authorize-email ${type === '*' ? '<type>' : type} --materiality N --evidence "<justification>"\n`
      + 'Sans jeton : publier avec send_email=false. La page existe, elle est partageable, personne n\'est réveillé.',
  };
}

module.exports = { mint, consume, grantDir, TTL_MS, HANDOFF_MS };
