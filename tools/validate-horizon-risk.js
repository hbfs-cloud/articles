#!/usr/bin/env node
'use strict';

// Gate bloquant : ce que le lecteur porte réellement pendant l'horizon d'une ligne publiée.
//
// Né de trois défauts constatés sur `scanner/20260908`, publié le 2026-09-06 :
//
//  1. Le FOMC des 15-16 septembre — avec projections économiques — tombait dans l'horizon de dix
//     séances de TOUTES les lignes, et la page ne le mentionnait pas. Le flux de calendrier
//     interrogé ne l'avait pas retourné, et rien ne vérifiait qu'il aurait dû. Le calendrier
//     collecté s'arrêtait d'ailleurs au 16 septembre, sans jamais avoir été confronté à la fin
//     d'horizon du 21.
//
//  2. Le même flux datait le PPI d'août au 14 septembre. La BLS le publie le 10. L'artefact était
//     pourtant CERTIFIÉ : empreinte, journal de collecte, provenance complète. La certification
//     prouve d'où vient un chiffre, elle ne peut pas savoir qu'il est faux.
//
//  3. Sept objectifs sur huit étaient posés à 1,50 ATR et la page présentait le rapport gain/risque
//     voisin de 1 comme une lecture du marché. C'était une géométrie, pas une découverte — et le
//     plancher de stop en pourcentage l'aggravait : 1,82 ATR sur KO, 2,14 sur PDBC, contre une
//     cible restée à 1,5, ce qui produit mécaniquement un ratio inférieur à 1 sur les titres les
//     MOINS volatils.
//
// Les trois ont en commun de ne pas être des erreurs de calcul : ce sont des choses qu'aucun
// contrôle ne regardait. D'où ce fichier.
//
//   node tools/validate-horizon-risk.js scanner/YYYYMMDD/

const fs = require('fs');
const path = require('path');
const cal = require('./lib/market-calendar');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data/scheduled-events.json');

// Termes de mécanisme retirés du processus. S'ils réapparaissent dans une phrase impérative, la
// page décrit deux régimes d'exécution incompatibles — c'était le cas de « VWAP », déclaré
// abandonné dans un paragraphe et rendu obligatoire dans trois autres.
const RETIRED_MECHANISMS = [
  { term: 'VWAP', retired_on: '2026-08-31', reason: 'la revue d\'août mesure que ce cérémonial d\'entrée ne produit aucun bénéfice' },
];

// Le calendrier PUBLIÉ porte des dates en français (« jeudi 10 septembre ») parce qu'il est écrit
// pour un lecteur. Le contrôle doit lire ce que le lecteur lit, sinon il contrôle autre chose que
// la page. L'année est déduite de la séance, la seule que le scan connaisse.
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function parseDate(raw, yearHint) {
  const t = String(raw || '').trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (isoMatch) return isoMatch[0];
  const frMatch = /(\d{1,2})(?:er)?\s+([a-zéûà]+)(?:\s+(\d{4}))?/i.exec(t);
  if (!frMatch) return null;
  const day = Number(frMatch[1]);
  const month = MOIS_FR.indexOf(frMatch[2].toLowerCase());
  if (month < 0 || !(day >= 1 && day <= 31)) return null;
  const year = frMatch[3] || String(yearHint);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const iso = d => String(d).slice(0, 10);

function horizonEnd(sessionDate, sessions) {
  // La séance d'entrée compte pour une. Dix séances depuis le mardi 8 septembre 2026 s'achèvent
  // donc le lundi 21, pas le vendredi 18 — c'est ce décalage d'une semaine qui faisait passer le
  // FOMC pour « hors fenêtre ».
  let d = sessionDate;
  for (let k = 1; k < sessions; k++) d = cal.nextUSTradingDay(d);
  return d;
}

function loadRegistry() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  if (!Array.isArray(reg.events) || !reg.coverage_until) throw new Error('registre d\'événements programmés illisible');
  return reg;
}

function collectedCalendar(dir, yearHint) {
  // Le calendrier publié vit dans data.json ; le calendrier collecté dans _data/economic_events.json
  // quand il est présent. On contrôle les deux : ce que la page MONTRE et ce que la collecte A VU.
  const out = { published: [], collected: [], collectedRange: null };
  const dataPath = path.join(dir, 'data.json');
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    for (const row of (data.macro_calendar || [])) {
      out.published.push({
        date: parseDate(row.date || row.day || '', yearHint),
        raw: String(row.date || ''),
        label: String(row.event || row.label || row.name || ''),
        note: String(row.note || ''),
      });
    }
  }
  const ecoPath = path.join(dir, '_data/economic_events.json');
  if (fs.existsSync(ecoPath)) {
    const doc = JSON.parse(fs.readFileSync(ecoPath, 'utf8'));
    const events = (doc.results || []).flatMap(r => ((r.data && r.data.events) || []));
    out.collected = events.map(e => ({ date: iso(e.event_time), label: String(e.name || ''), impact: String(e.impact || '') }));
    const dates = out.collected.map(e => e.date).filter(Boolean).sort();
    if (dates.length) out.collectedRange = { from: dates[0], to: dates[dates.length - 1] };
  }
  return out;
}

function validate(dirRel) {
  const dir = path.resolve(ROOT, dirRel);
  const errors = [];
  const notes = [];

  const sigPath = path.join(dir, 'signals.json');
  if (!fs.existsSync(sigPath)) return { errors: [`${dirRel}: signals.json absent`], notes };
  const sig = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const signals = sig.signals || [];
  if (!signals.length) return { errors: [], notes: ['aucun signal — rien à contrôler'] };

  const session = `${sig.scanDate.slice(0, 4)}-${sig.scanDate.slice(4, 6)}-${sig.scanDate.slice(6, 8)}`;
  const maxHorizon = Math.max(...signals.map(s => Number(s.horizon) || 0));
  if (!Number.isFinite(maxHorizon) || maxHorizon < 1) errors.push('horizon de signal illisible');
  const end = horizonEnd(session, maxHorizon);
  notes.push(`séance ${session}, horizon max ${maxHorizon} séances → dernière séance portée ${end}`);

  const reg = loadRegistry();
  const calendars = collectedCalendar(dir, session.slice(0, 4));

  // ── 1. Le registre doit couvrir l'horizon ─────────────────────────────────
  // Fail-closed délibéré : un registre qu'on croit complet est plus dangereux qu'un gate qui bloque.
  if (end > reg.coverage_until) {
    errors.push(`le registre d'événements programmés s'arrête au ${reg.coverage_until}, l'horizon va jusqu'au ${end} — étendre data/scheduled-events.json depuis les sources primaires`);
  }

  // ── 2. La collecte doit avoir REGARDÉ jusqu'au bout de l'horizon ──────────
  if (calendars.collectedRange && calendars.collectedRange.to < end) {
    // Un trou de couverture peut être assumé, jamais tu. Le déclarer oblige à l'écrire sur la page,
    // donc à le dire au lecteur : au-delà de telle date, seuls les événements annoncés à l'avance
    // sont couverts, et un rendez-vous non programmé a pu passer inaperçu.
    const declared = readProse(dir).includes(calendars.collectedRange.to);
    const msg = `le calendrier collecté s'arrête au ${calendars.collectedRange.to} alors que l'horizon va jusqu'au ${end}`;
    if (declared) notes.push(`${msg} — trou déclaré sur la page, seuls les événements du registre couvrent la fin de fenêtre`);
    else errors.push(`${msg} : la fenêtre n'a jamais été regardée jusqu'au bout, et la page ne le dit pas`);
  }

  // ── 3. Tout événement programmé de l'horizon doit être publié ─────────────
  // Appariement par MOT-CLÉ distinctif du registre, jamais par préfixe de libellé : « Décision de
  // taux de la… » matche autant la Réserve fédérale que la Banque centrale européenne, et un gate
  // qui produit des faux positifs finit par être ignoré — ce qui est pire que pas de gate.
  const matches = (row, ev) => (ev.match || []).some(k => new RegExp(k, 'i').test(row.label));
  const inHorizon = reg.events.filter(e => e.date >= session && e.date <= end);
  for (const ev of inHorizon) {
    const candidates = calendars.published.filter(p => matches(p, ev));
    if (!candidates.length) {
      errors.push(`« ${ev.label_fr} » du ${ev.date} tombe dans l'horizon et n'apparaît pas au calendrier publié (source : ${reg.sources[ev.source].authority})`);
    } else if (!candidates.some(p => p.date === ev.date)) {
      errors.push(`« ${ev.label_fr} » est publié au ${candidates.map(p => p.raw || p.date).join(', ')} alors que l'autorité le fixe au ${ev.date} (${reg.sources[ev.source].authority})`);
    }
  }

  // ── 4. Le flux collecté doit s'accorder au registre ───────────────────────
  // C'est ce contrôle qui attrape un artefact certifié mais FAUX. La provenance ne dit rien de
  // l'exactitude ; seule une seconde autorité le dit.
  for (const ev of reg.events) {
    if (!calendars.collectedRange) break;
    if (ev.date < calendars.collectedRange.from || ev.date > calendars.collectedRange.to) continue;
    const match = calendars.collected.find(c => (ev.match_feed || ev.match || []).some(k => new RegExp(k, 'i').test(c.label)));
    if (!match) {
      const rescued = calendars.published.some(p => matches(p, ev) && p.date === ev.date);
      if (rescued) { notes.push(`« ${ev.id} » du ${ev.date} manquait au flux collecté ; le registre l'a fourni et la page le porte à la bonne date`); continue; }
      errors.push(`le flux collecté ne contient pas « ${ev.id} » du ${ev.date}, pourtant dans sa propre fenêtre — l'absence dans un flux n'est pas une absence dans le monde`);
    } else if (match.date !== ev.date) {
      errors.push(`le flux collecté date « ${ev.id} » du ${match.date}, l'autorité du ${ev.date} (${reg.sources[ev.source].authority}) — artefact certifié mais faux`);
    }
  }

  // ── 5. La géométrie des niveaux doit être déclarée ────────────────────────
  const mult = signals.map(s => Number(s.tp1_atr_multiple)).filter(Number.isFinite);
  if (mult.length >= 3) {
    const med = [...mult].sort((a, b) => a - b)[Math.floor(mult.length / 2)];
    const clustered = mult.filter(m => Math.abs(m - med) <= 0.05).length;
    if (clustered / mult.length >= 0.6) {
      notes.push(`${clustered}/${mult.length} objectifs regroupés à ${med.toFixed(2)} ATR — géométrie, pas analyse de résistance`);
      const prose = readProse(dir);
      if (!/formule|géométri|multiple d.ATR|même distance/i.test(prose)) {
        errors.push(`${clustered} objectifs sur ${mult.length} sont posés au même multiple d'ATR (${med.toFixed(2)}) : la page doit dire que ces niveaux viennent d'une formule, pas d'une lecture de résistance`);
      }
      // Restreint aux phrases qui parlent DU RATIO. La première version attrapait « exactement la
      // séquence qui déplace la composante énergie » — un adverbe sans rapport. Un gate qui crie
      // sur des faux positifs se fait désarmer, et alors il ne protège plus de rien.
      const clean = prose.replace(/<[^>]+>/g, ' ');
      const about = clean.split(/(?<=[.!?])\s+/).filter(x => /gain\s*\/\s*risque|\bR\/R\b|ratio/i.test(x));
      const overclaim = about.find(x => /\bexact\b|\bexacte(?:ment)?\s+(?:mesur|calcul|lu)|mesuré, pas estimé|découvert par le marché|lecture du marché/i.test(x)
        && !/formule|géométri|multiple d.ATR|par construction|découle mécaniquement/i.test(x));
      if (overclaim) {
        errors.push(`la page présente le rapport gain/risque comme une mesure du marché : « ${overclaim.trim().slice(0, 110)} »`);
      }
    }
  }

  // ── 6. Un stop plus large que la cible garantit un ratio sous 1 ───────────
  for (const s of signals) {
    const tp = Number(s.tp1_atr_multiple);
    const rr = Number(s.rr_entry);
    if (!Number.isFinite(tp) || !Number.isFinite(rr) || rr <= 0) continue;
    const stopMult = tp / rr;
    if (stopMult > tp + 0.05) {
      const prose = readProse(dir);
      if (!/plancher|plus large que l.objectif|moins volatil/i.test(prose)) {
        errors.push(`${s.ticker}: stop à ${stopMult.toFixed(2)} ATR contre un objectif à ${tp.toFixed(2)} ATR — le ratio est sous 1 par construction, et la page ne l'explique pas`);
      }
    }
  }

  // ── 7. Un seul régime d'exécution ─────────────────────────────────────────
  const html = readProse(dir);
  for (const m of RETIRED_MECHANISMS) {
    const hits = (html.match(new RegExp(m.term, 'g')) || []).length;
    if (!hits) continue;
    // Un mécanisme retiré peut légitimement être NOMMÉ pour dire qu'il ne s'applique pas
    // (« sans condition de VWAP »). Ne compter que les phrases qui l'IMPOSENT, et écarter d'abord
    // les formes négatives — sans quoi le gate condamne la page qui fait exactement ce qu'on lui
    // demande, et un gate qui punit la bonne conduite finit désarmé.
    const text = html.replace(/<[^>]+>/g, ' ');
    const sentences = text.split(/(?<=[.!?])\s+/).filter(x => new RegExp(m.term).test(x));
    const negated = new RegExp(`(?:ni|sans|pas de|aucune?)\\s+(?:condition\\s+de\\s+)?${m.term}|${m.term}[^.]{0,40}(?:retiré|abandonné|supprimé|ne s'applique)`, 'i');
    const imperative = sentences.some(x => !negated.test(x)
      && new RegExp(`${m.term}[^.]{0,120}?(?:doit|obligatoire|attendre|réarme|il faut|exiger|uniquement si|qu'après)`, 'i').test(x));
    if (imperative) {
      errors.push(`« ${m.term} » est retiré depuis le ${m.retired_on} (${m.reason}) mais la page en fait encore une règle : deux régimes d'exécution incompatibles sur la même page`);
    } else {
      notes.push(`« ${m.term} » mentionné ${hits} fois, sans forme impérative — vérifier qu'il s'agit bien d'une explication historique`);
    }
  }

  return { errors: [...new Set(errors)], notes };
}

let proseCache = null;
function readProse(dir) {
  if (proseCache !== null) return proseCache;
  const p = path.join(dir, 'index.html');
  proseCache = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return proseCache;
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) { console.error('Usage: validate-horizon-risk.js scanner/YYYYMMDD/'); process.exit(2); }
  let out;
  try { out = validate(target.replace(/\/$/, '')); }
  catch (error) { console.error(`[horizon-risk] ERREUR: ${error.message}`); process.exit(1); }
  for (const n of out.notes) console.log(`[horizon-risk] · ${n}`);
  if (out.errors.length) {
    console.error('[horizon-risk] FAIL');
    out.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('[horizon-risk] PASS');
}

module.exports = { validate, horizonEnd, RETIRED_MECHANISMS };
